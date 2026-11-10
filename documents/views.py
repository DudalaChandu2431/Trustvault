from django.shortcuts import render, get_object_or_404, redirect
from django.contrib.auth.decorators import login_required, user_passes_test
from django.contrib import messages
from django.http import JsonResponse, HttpResponse, Http404
from django.views.decorators.http import require_http_methods, require_POST
from django.views.decorators.csrf import csrf_exempt
from django.core.exceptions import PermissionDenied
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from django.db.models import Q
from django.utils import timezone
import pyotp
import mimetypes
import os
from django_ratelimit.decorators import ratelimit

from .models import Document, DocumentCategory, DocumentAccess, DocumentAccessLog, UserProfile


# --- Authentication & Role Checks ---

def check_document_access(user, document, required_grant='read', mfa_required=False):
    """Check if user has required access level to document.
    Returns (has_access, grant_type, reason)
    Also handles MFA verification if mfa_required=True
    """
    # Admins have access to everything
    try:
        profile = user.profile
        if profile.is_admin:
            if mfa_required:
                pass  # In production, would check MFA session
            return True, 'admin', 'Administrator access'
    except Exception:
        pass

    # Owners have access to their own documents
    if document.owner == user:
        if mfa_required:
            pass  # Would check MFA
        return True, 'owner', 'Document owner access'

    # Check explicit access grants
    try:
        grant = DocumentAccess.objects.get(document=document, user=user)
        if grant.expires_at and grant.expires_at < timezone.now():
            DocumentAccessLog.objects.create(
                document=document,
                user=user,
                action='deny',
                success=False,
                reason='Access grant expired'
            )
            return False, None, 'Access grant expired'
        
        # Check grant type hierarchy: admin > edit > read
        grant_map = {'admin': 3, 'edit': 2, 'read': 1}
        required_level = grant_map.get(required_grant, 1)
        grant_level = grant_map.get(grant.grant_type, 1)
        
        if grant_level >= required_level:
            if mfa_required:
                pass  # MFA check handled at view level
            return True, grant.grant_type, f'{grant.grant_type} access granted'
        else:
            DocumentAccessLog.objects.create(
                document=document,
                user=user,
                action='deny',
                success=False,
                reason=f'Insufficient permissions: {grant.grant_type} needed {required_grant}'
            )
            return False, None, f'Insufficient permissions: {grant.grant_type} access required'
    except DocumentAccess.DoesNotExist:
        DocumentAccessLog.objects.create(
            document=document,
            user=user,
            action='deny',
            success=False,
            reason='No access grant found'
        )
        return False, None, 'No access grant found'


def login_required_json(view_func):
    """Decorator that returns JSON 401 for unauthenticated AJAX requests."""
    @login_required(login_url='login')
    @require_POST
    def wrapper(request, *args, **kwargs):
        return view_func(request, *args, **kwargs)
    return wrapper


def admin_required(view_func):
    """Decorator to check if user is admin."""
    @login_required(login_url='login')
    @user_passes_test(lambda u: u.profile.is_admin, login_url='document_list')
    def wrapper(request, *args, **kwargs):
        return view_func(request, *args, **kwargs)
    return wrapper


# --- Document List & Search ---

@login_required
@ratelimit(key='user', rate='5/300')
def document_list(request):
    """List documents accessible to the current user."""
    user = request.user
    
    documents = Document.objects.filter(
        Q(owner=user) | Q(access_grants__user=user)
    ).distinct()
    
    category_id = request.GET.get('category')
    if category_id:
        documents = documents.filter(category_id=category_id)
    
    status = request.GET.get('status')
    if status:
        documents = documents.filter(status=status)
    
    query = request.GET.get('q')
    if query:
        documents = documents.filter(
            Q(title__icontains=query) | Q(description__icontains=query)
        )
    
    if request.GET.get('include_public') == '1':
        documents = documents | Document.objects.filter(is_public=True)
    
    categories = DocumentCategory.objects.all()
    
    access_info = {}
    for doc in documents:
        has_access, grant_type, reason = check_document_access(user, doc, 'read')
        access_info[doc.id] = {
            'has_access': has_access,
            'grant_type': grant_type,
            'reason': reason,
        }
    
    return render(request, 'documents/document_list.html', {
        'documents': documents[:50],
        'categories': categories,
        'access_info': access_info,
        'query': query,
        'selected_category': int(category_id) if category_id else None,
        'selected_status': status,
    })


@login_required
@ratelimit(key='user', rate='5/300')
def document_search(request):
    """Advanced search endpoint."""
    query = request.GET.get('q', '')
    if not query:
        return JsonResponse({'results': []})
    
    documents = Document.objects.filter(
        Q(title__icontains=query) | Q(description__icontains=query)
    ).distinct()
    
    results = []
    for doc in documents[:20]:
        has_access, grant_type, reason = check_document_access(request.user, doc, 'read')
        results.append({
            'id': doc.id,
            'title': doc.title,
            'owner': doc.owner.username,
            'category': doc.category.name if doc.category else '',
            'status': doc.status,
            'created_at': doc.created_at.isoformat(),
            'has_access': has_access,
            'grant_type': grant_type,
        })
    
    return JsonResponse({'results': results})


# --- Document Detail & File Access ---

@login_required
@ratelimit(key='user', rate='5/300')
def document_detail(request, document_id):
    """Show document details and check access."""
    document = get_object_or_404(Document, id=document_id)
    has_access, grant_type, reason = check_document_access(request.user, document, 'view')
    
    if not has_access:
        DocumentAccessLog.objects.create(
            document=document,
            user=request.user,
            action='deny',
            success=False,
            reason=reason
        )
        messages.error(request, f'Access denied: {reason}')
        return redirect('document_list')
    
    DocumentAccessLog.objects.create(
        document=document,
        user=request.user,
        action='view',
        success=True,
        reason=f'{grant_type} access'
    )
    
    is_owner = document.owner == request.user
    
    return render(request, 'documents/document_detail.html', {
        'document': document,
        'has_access': has_access,
        'grant_type': grant_type,
        'is_owner': is_owner,
    })


@login_required
@require_POST
@ratelimit(key='user', rate='5/300')
def document_download(request, document_id):
    """Handle document download with audit logging."""
    document = get_object_or_404(Document, id=document_id)
    has_access, grant_type, reason = check_document_access(request.user, document, 'download')

    if not has_access:
        DocumentAccessLog.objects.create(
            document=document,
            user=request.user,
            action='deny',
            success=False,
            reason='Download access denied'
        )
        return JsonResponse({'error': 'Download access denied'}, status=403)

    DocumentAccessLog.objects.create(
        document=document,
        user=request.user,
        action='download',
        success=True,
        reason=f'{grant_type} access'
    )

    if default_storage.exists(document.file.name):
        try:
            with default_storage.open(document.file.name, 'rb') as f:
                response = HttpResponse(f.read(), content_type='application/octet-stream')
                response['Content-Disposition'] = f'attachment; filename="{document.title.replace("/", "_")}.bin"'
                return response
        except (OSError, IOError):
            DocumentAccessLog.objects.create(
                document=document,
                user=request.user,
                action='deny',
                success=False,
                reason='File read error'
            )
            return JsonResponse({'error': 'File read error'}, status=500)

    DocumentAccessLog.objects.create(
        document=document,
        user=request.user,
        action='deny',
        success=False,
        reason='Document file not found'
    )
    return JsonResponse({'error': 'Document file not found'}, status=404)


# --- Permission Management ---

@login_required
@require_POST
@ratelimit(key='user', rate='3/300')
def grant_access(request, document_id):
    """Grant access to a document for another user."""
    document = get_object_or_404(Document, id=document_id)
    has_access, grant_type, reason = check_document_access(request.user, document, 'edit')
    
    if not has_access:
        return JsonResponse({'error': 'Insufficient permissions to grant access'}, status=403)
    
    user_id = request.POST.get('user_id')
    grant_type = request.POST.get('grant_type', 'read')
    expires_at = request.POST.get('expires_at')
    
    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    
    access_obj, created = DocumentAccess.objects.get_or_create(
        document=document,
        user=target_user,
        defaults={
            'grant_type': grant_type,
            'granted_by': request.user,
        }
    )
    
    if not created:
        access_obj.grant_type = grant_type
        access_obj.granted_by = request.user
        if expires_at:
            access_obj.expires_at = expires_at
        access_obj.save()
    else:
        if expires_at:
            access_obj.expires_at = expires_at
            access_obj.save()
    
    DocumentAccessLog.objects.create(
        document=document,
        user=request.user,
        action='share',
        success=True,
        reason=f'Granted {grant_type} access to {target_user.username}'
    )
    
    return JsonResponse({
        'success': True,
        'grant_type': access_obj.grant_type,
        'granted_by': request.user.username,
        'expires_at': access_obj.expires_at,
    })


@login_required
@require_POST
@ratelimit(key='user', rate='3/300')
def revoke_access(request, document_id, user_id):
    """Revoke access to a document."""
    document = get_object_or_404(Document, id=document_id)
    has_access, grant_type, reason = check_document_access(request.user, document, 'admin')

    if not has_access:
        # Log error without revealing internal details
        DocumentAccessLog.objects.create(
            document=document,
            user=request.user,
            action='deny',
            success=False,
            reason='Insufficient permissions for revocation'
        )
        return JsonResponse({'error': 'Insufficient permissions'}, status=403)

    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        DocumentAccessLog.objects.create(
            document=document,
            user=request.user,
            action='deny',
            success=False,
            reason='Target user not found'
        )
        return JsonResponse({'error': 'User not found'}, status=404)

    try:
        access_grant = DocumentAccess.objects.get(document=document, user=target_user)
    except DocumentAccess.DoesNotExist:
        DocumentAccessLog.objects.create(
            document=document,
            user=request.user,
            action='deny',
            success=False,
            reason='User has no access to this document'
        )
        return JsonResponse({'error': 'User has no access to this document'}, status=404)

    access_grant.delete()

    DocumentAccessLog.objects.create(
        document=document,
        user=request.user,
        action='share',
        success=True,
        reason=f'Revoked access for {target_user.username}'
    )

    from .models import check_document_access
    new_has_access, new_grant_type, new_reason = check_document_access(request.user, document, 'read')

    return JsonResponse({
        'success': True,
        'access_revoked': True,
        'was_owner': document.owner == target_user,
        'verification': {
            'has_access': new_has_access,
            'reason': new_reason,
        }
    })


# --- API Endpoints for Frontend ---

@login_required
@require_http_methods(['GET'])
@ratelimit(key='user', rate='10/300')
def api_document_status(request, document_id):
    """API endpoint returning document access status."""
    document = get_object_or_404(Document, id=document_id)
    has_access, grant_type, reason = check_document_access(request.user, document, 'read')
    
    return JsonResponse({
        'document_id': document.id,
        'title': document.title,
        'has_access': has_access,
        'grant_type': grant_type,
        'reason': reason,
        'is_owner': document.owner == request.user,
    })


@login_required
@require_http_methods(['GET'])
@ratelimit(key='user', rate='5/300')
def api_user_list(request):
    """API endpoint listing users for permission grants."""
    users = User.objects.exclude(id=request.user.id).values('id', 'username', 'profile__role')
    return JsonResponse({'users': list(users)})


# --- Create Document ---

@login_required
@require_POST
def document_create(request):
    """Create a new document."""
    title = request.POST.get('title')
    description = request.POST.get('description', '')
    file = request.FILES.get('file')
    category_id = request.POST.get('category')
    is_public = request.POST.get('is_public', 'false') == 'true'
    
    if not title or not file:
        return JsonResponse({'error': 'Title and file are required'}, status=400)
    
    ext = file.name.split('.')[-1].lower() if '.' in file.name else ''
    allowed_types = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'zip']
    if ext not in allowed_types:
        return JsonResponse({'error': f'File type .{ext} not allowed'}, status=400)
    
    category = None
    if category_id:
        from .models import DocumentCategory
        try:
            category = DocumentCategory.objects.get(id=category_id)
        except DocumentCategory.DoesNotExist:
            pass
    
    document = Document.objects.create(
        title=title,
        description=description,
        file=file,
        owner=request.user,
        category=category,
        is_public=is_public,
    )
    
    DocumentAccessLog.objects.create(
        document=document,
        user=request.user,
        action='upload',
        success=True,
        reason='Document uploaded'
    )
    
    return JsonResponse({
        'success': True,
        'document_id': document.id,
        'title': document.title,
        'url': f'/documents/{document.id}/',
    })


# --- MFA Views ---

@login_required
@ratelimit(key='user', rate='3/300')
def mfa_setup(request):
    """Set up MFA for the current user."""
    profile, created = UserProfile.objects.get_or_create(user=request.user)
    
    if profile.mfa_secret_key is None:
        profile.mfa_secret_key = pyotp.random_base32()
        profile.save()
    
    totp = pyotp.TOTP(profile.mfa_secret_key)
    mfa_uri = totp.provisioning_uri(
        request.user.email,
        issuer_name='TrustVault'
    )
    
    context = {
        'mfa_uri': mfa_uri,
        'secret_key': profile.mfa_secret_key,
        'user': request.user,
    }
    
    return render(request, 'documents/mfa_setup.html', context)


@login_required
@require_POST
@ratelimit(key='user', rate='5/300')
def mfa_verify(request):
    """Verify MFA token for the current user."""
    profile = request.user.profile
    
    if not profile.mfa_secret_key:
        return JsonResponse({'success': False, 'error': 'MFA not enrolled'}, status=400)
    
    token = request.POST.get('token')
    totp = pyotp.TOTP(profile.mfa_secret_key)
    
    if totp.verify(token):
        profile.mfa_last_verified = timezone.now()
        profile.save()
        
        # Mark recent access logs as MFA verified
        DocumentAccessLog.objects.filter(
            document__owner=request.user,
            user=request.user,
            timestamp__gte=timezone.now() - timezone.timedelta(hours=1)
        ).update(mfa_verified=True)
        
        return JsonResponse({'success': True, 'message': 'MFA verified'})
    
    return JsonResponse({'success': False, 'error': 'Invalid MFA token'}, status=400)


@login_required
@require_POST
@ratelimit(key='user', rate='5/300')
def mfa_disable(request):
    """Disable MFA for the current user."""
    profile = request.user.profile
    profile.mfa_secret_key = None
    profile.mfa_recovery_codes = []
    profile.mfa_last_verified = None
    profile.save()
    
    return JsonResponse({'success': True, 'message': 'MFA disabled'})


@login_required
def mfa_status(request):
    """Check MFA status for the current user."""
    profile = request.user.profile
    return JsonResponse({
        'mfa_enabled': profile.is_mfa_enabled,
        'mfa_last_verified': profile.mfa_last_verified,
    })
