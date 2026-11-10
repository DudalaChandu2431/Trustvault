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
import mimetypes
import os

from .models import Document, DocumentCategory, DocumentAccess, DocumentAccessLog, UserProfile


# --- Authentication & Role Checks ---

def check_document_access(user, document, required_grant='read'):
    """Check if user has required access level to document.
    Returns (has_access, grant_type, reason)
    """
    # Admins have access to everything
    try:
        profile = user.profile
        if profile.is_admin:
            return True, 'admin', 'Administrator access'
    except Exception:
        pass

    # Owners have access to their own documents
    if document.owner == user:
        return True, 'owner', 'Document owner access'

    # Check explicit access grants
    try:
        grant = DocumentAccess.objects.get(document=document, user=user)
        if grant.expires_at and grant.expires_at < timezone.now():
            # Access has expired
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
        # No explicit access grant - deny
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
def document_list(request):
    """List documents accessible to the current user."""
    user = request.user
    
    # Start with documents owned by user or where they have access
    documents = Document.objects.filter(
        Q(owner=user) | Q(access_grants__user=user)
    ).distinct()
    
    # Filter by category if specified
    category_id = request.GET.get('category')
    if category_id:
        documents = documents.filter(category_id=category_id)
    
    # Filter by status if specified
    status = request.GET.get('status')
    if status:
        documents = documents.filter(status=status)
    
    # Search by name
    query = request.GET.get('q')
    if query:
        documents = documents.filter(
            Q(title__icontains=query) | Q(description__icontains=query)
        )
    
    # Filter by is_public for public documents
    if request.GET.get('include_public') == '1':
        documents = documents | Document.objects.filter(is_public=True)
    
    categories = DocumentCategory.objects.all()
    
    # Annotate with access info
    access_info = {}
    for doc in documents:
        has_access, grant_type, reason = check_document_access(user, doc, 'read')
        access_info[doc.id] = {
            'has_access': has_access,
            'grant_type': grant_type,
            'reason': reason,
        }
    
    return render(request, 'documents/document_list.html', {
        'documents': documents[:50],  # Limit results
        'categories': categories,
        'access_info': access_info,
        'query': query,
        'selected_category': int(category_id) if category_id else None,
        'selected_status': status,
    })


@login_required
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
def document_detail(request, document_id):
    """Show document details and check access."""
    document = get_object_or_404(Document, id=document_id)
    has_access, grant_type, reason = check_document_access(request.user, document, 'view')
    
    if not has_access:
        # Log the deny attempt
        DocumentAccessLog.objects.create(
            document=document,
            user=request.user,
            action='deny',
            success=False,
            reason=reason
        )
        messages.error(request, f'Access denied: {reason}')
        return redirect('document_list')
    
    # Log the view
    DocumentAccessLog.objects.create(
        document=document,
        user=request.user,
        action='view',
        success=True,
        reason=f'{grant_type} access'
    )
    
    # Check if user is the owner
    is_owner = document.owner == request.user
    
    return render(request, 'documents/document_detail.html', {
        'document': document,
        'has_access': has_access,
        'grant_type': grant_type,
        'is_owner': is_owner,
    })


@login_required
@require_POST
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
            reason=reason
        )
        return JsonResponse({'error': reason}, status=403)
    
    # Log the download
    DocumentAccessLog.objects.create(
        document=document,
        user=request.user,
        action='download',
        success=True,
        reason=f'{grant_type} access'
    )
    
    # Serve the file
    if default_storage.exists(document.file.name):
        # Read file and return
        with default_storage.open(document.file.name, 'rb') as f:
            response = HttpResponse(f.read(), content_type='application/octet-stream')
            content_type, encoding = mimetypes.guess_type(document.file.name)
            if content_type:
                response['Content-Type'] = content_type
            else:
                response['Content-Type'] = 'application/octet-stream'
            
            # Set download headers
            filename = document.title.replace('/', '_')
            response['Content-Disposition'] = f'attachment; filename="{filename}.bin"'
            return response
    
    raise Http404("Document file not found")


# --- Permission Management ---

@login_required
@require_POST
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
    
    # Check if access already exists and update or create
    access_obj, created = DocumentAccess.objects.get_or_create(
        document=document,
        user=target_user,
        defaults={
            'grant_type': grant_type,
            'granted_by': request.user,
        }
    )
    
    if not created:
        # Update existing grant
        access_obj.grant_type = grant_type
        access_obj.granted_by = request.user
        if expires_at:
            access_obj.expires_at = expires_at
        access_obj.save()
    else:
        # Set expires_at if provided
        if expires_at:
            access_obj.expires_at = expires_at
            access_obj.save()
    
    # Log the permission change
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
def revoke_access(request, document_id, user_id):
    """Revoke access to a document."""
    document = get_object_or_404(Document, id=document_id)
    has_access, grant_type, reason = check_document_access(request.user, document, 'admin')
    
    if not has_access:
        return JsonResponse({'error': 'Insufficient permissions to revoke access'}, status=403)
    
    try:
        target_user = User.objects.get(id=user_id)
    except User.DoesNotExist:
        return JsonResponse({'error': 'User not found'}, status=404)
    
    # Check if user has access to revoke
    try:
        access_grant = DocumentAccess.objects.get(document=document, user=target_user)
    except DocumentAccess.DoesNotExist:
        return JsonResponse({'error': 'User has no access to this document'}, status=404)
    
    # CRITICAL: Delete the access grant immediately - access stops working
    access_grant.delete()
    
    # Log the revocation
    DocumentAccessLog.objects.create(
        document=document,
        user=request.user,
        action='share',
        success=True,
        reason=f'Revoked access for {target_user.username}'
    )
    
    # Verify access is actually revoked
    # After deletion, the user should no longer have access
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
    
    # Validate file type
    ext = file.name.split('.')[-1].lower() if '.' in file.name else ''
    allowed_types = ['pdf', 'doc', 'docx', 'txt', 'jpg', 'jpeg', 'png', 'zip']
    if ext not in allowed_types:
        return JsonResponse({'error': f'File type .{ext} not allowed'}, status=400)
    
    # Determine category
    category = None
    if category_id:
        from .models import DocumentCategory
        try:
            category = DocumentCategory.objects.get(id=category_id)
        except DocumentCategory.DoesNotExist:
            pass
    
    # Create document
    document = Document.objects.create(
        title=title,
        description=description,
        file=file,
        owner=request.user,
        category=category,
        is_public=is_public,
    )
    
    # Owner automatically gets edit access (already have it via ownership)
    
    # Log the upload
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


# --- Admin Views ---

def timezone_now():
    """Get current timezone-aware datetime."""
    return timezone.now()


@admin_required
def admin_dashboard(request):
    """Administrative dashboard showing document activity and permission changes."""
    now = timezone_now()
    last_week = now - timezone.timedelta(days=7)
    last_month = now - timezone.timedelta(days=30)
    
    # Recent access logs
    recent_logs = DocumentAccessLog.objects.select_related('document', 'user').order_by('-timestamp')[:100]
    
    # Permission changes in last 30 days
    perm_changes = DocumentAccessLog.objects.filter(
        action='share',
        timestamp__gte=last_month
    ).select_related('document', 'user')[:50]
    
    # Documents with is_public=True
    problematic_docs = Document.objects.filter(is_public=True).count()
    
    # User activity summary
    user_activity = {}
    for log in recent_logs:
        user_id = log.user.id if log.user else 'anonymous'
        if user_id not in user_activity:
            user_activity[user_id] = {
                'total_actions': 0,
                'views': 0,
                'downloads': 0,
                'permission_changes': 0,
            }
        user_activity[user_id]['total_actions'] += 1
        if log.action == 'view':
            user_activity[user_id]['views'] += 1
        if log.action == 'download':
            user_activity[user_id]['downloads'] += 1
        if log.action == 'share':
            user_activity[user_id]['permission_changes'] += 1
    
    # Top accessed documents
    doc_activity = {}
    for log in recent_logs:
        doc_id = log.document.id
        if doc_id not in doc_activity:
            doc_activity[doc_id] = {
                'title': log.document.title,
                'access_count': 0,
                'views': 0,
                'downloads': 0,
            }
        doc_activity[doc_id]['access_count'] += 1
        if log.action == 'view':
            doc_activity[doc_id]['views'] += 1
        if log.action == 'download':
            doc_activity[doc_id]['downloads'] += 1
    
    # Sort by access count
    top_docs = sorted(doc_activity.items(), key=lambda x: x[1]['access_count'], reverse=True)[:10]
    
    return render(request, 'documents/admin_dashboard.html', {
        'recent_logs': recent_logs[:20],
        'perm_changes': perm_changes,
        'problematic_docs': problematic_docs,
        'user_activity': user_activity,
        'top_docs': top_docs,
    })


@admin_required
def admin_permission_audit(request):
    """Administrative view of all permission changes."""
    now = timezone_now()
    last_30_days = now - timezone.timedelta(days=30)
    last_24_hours = now - timezone.timedelta(hours=24)
    
    # Recent permission changes (DocumentAccess grants)
    recent_permissions = DocumentAccess.objects.select_related(
        'document', 'user', 'granted_by'
    ).order_by('-granted_at')[:100]
    
    # Permission changes in last 24 hours
    recent_24h = DocumentAccess.objects.filter(
        granted_at__gte=last_24_hours
    ).select_related('document', 'user', 'granted_by')
    
    # Permission changes in last 30 days
    recent_30d = DocumentAccess.objects.filter(
        granted_at__gte=last_30_days
    ).select_related('document', 'user', 'granted_by')
    
    # Stats
    total_grants = DocumentAccess.objects.count()
    active_grants = DocumentAccess.objects.filter(expires_at__isnull=True).count() + \
                   DocumentAccess.objects.filter(expires_at__gt=now).count()
    
    expired_grants = DocumentAccess.objects.filter(expires_at__lt=now).count()
    
    return render(request, 'documents/admin_permission_audit.html', {
        'recent_permissions': recent_permissions,
        'recent_24h': recent_24h,
        'recent_30d': recent_30d,
        'total_grants': total_grants,
        'active_grants': active_grants,
        'expired_grants': expired_grants,
    })
