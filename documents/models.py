from django.db import models
from django.contrib.auth import get_user_model
from django.utils import timezone
import pyotp  # Import at top level


User = get_user_model()


class DocumentCategory(models.Model):
    """Categories for document organization and search."""
    name = models.CharField(max_length=100, unique=True)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name_plural = 'Document Categories'
        ordering = ['name']

    def __str__(self):
        return self.name


class Document(models.Model):
    """Main document model with secure permissions."""
    STATUS_CHOICES = [
        ('draft', 'Draft'),
        ('published', 'Published'),
        ('archived', 'Archived'),
    ]

    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to='documents/%Y/%m/%d/')
    owner = models.ForeignKey(User, on_delete=models.CASCADE, related_name='owned_documents')
    category = models.ForeignKey(DocumentCategory, on_delete=models.SET_NULL, null=True, blank=True)
    status = models.CharField(max_length=20, default='draft')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    # Audit tracking
    is_public = models.BooleanField(default=False, help_text="Check if document should be visible to all authenticated users")
    version = models.IntegerField(default=1)

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['owner']),
            models.Index(fields=['category']),
        ]

    def __str__(self):
        return f"{self.title} (by {self.owner.username})"


class DocumentAccess(models.Model):
    """Permission grants: who can access which document."""
    GRANT_TYPE_CHOICES = [
        ('read', 'Read only'),
        ('edit', 'Edit'),
        ('admin', 'Administer'),
    ]

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='access_grants')
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    grant_type = models.CharField(max_length=20, choices=GRANT_TYPE_CHOICES)
    granted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='granted_access')
    granted_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField(null=True, blank=True, help_text="Optional expiration date for access grant")

    class Meta:
        unique_together = ['document', 'user']
        indexes = [
            models.Index(fields=['document', 'user']),
            models.Index(fields=['expires_at']),
        ]

    def __str__(self):
        return f"{self.user.username} - {self.document.title}: {self.grant_type}"


class DocumentAccessLog(models.Model):
    """Audit trail of all document access attempts."""
    ACTION_CHOICES = [
        ('view', 'Viewed'),
        ('download', 'Downloaded'),
        ('edit', 'Edited'),
        ('share', 'Shared/permissions changed'),
        ('deny', 'Access denied'),
    ]

    document = models.ForeignKey(Document, on_delete=models.CASCADE, related_name='access_logs')
    user = models.ForeignKey(User, on_delete=models.CASCADE, null=True, blank=True,
                             help_text="User who attempted access; null for unauthenticated attempts")
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    timestamp = models.DateTimeField(auto_now_add=True)
    success = models.BooleanField(default=False)
    reason = models.CharField(max_length=255, blank=True,
                              help_text="Why access was granted or denied")
    # MFA tracking
    mfa_verified = models.BooleanField(default=False, help_text="Was MFA verified for this access attempt?")

    class Meta:
        ordering = ['-timestamp']
        indexes = [
            models.Index(fields=['-timestamp']),
            models.Index(fields=['document', 'success']),
            models.Index(fields=['action']),
        ]

    def __str__(self):
        status = "granted" if self.success else "denied"
        mfa = " MFA" if self.mfa_verified else ""
        return f"{self.action}{mfa} - {self.document.title}: {status} ({self.timestamp})"


class UserProfile(models.Model):
    """Extended user profile with role information and MFA."""
    ROLE_CHOICES = [
        ('admin', 'Administrator'),
        ('owner', 'Document Owner'),
        ('viewer', 'Viewer'),
    ]

    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='viewer')
    department = models.CharField(max_length=100, blank=True)
    phone = models.CharField(max_length=50, blank=True)
    # MFA fields
    is_mfa_enabled = models.BooleanField(default=False, help_text="Whether MFA is enabled for this user")
    mfa_secret_key = models.CharField(max_length=32, null=True, blank=True, help_text="Base32-encoded TOTP secret key")
    mfa_recovery_codes = models.JSONField(default=list, help_text="Used recovery codes, empty list if none used")
    mfa_last_verified = models.DateTimeField(null=True, blank=True, help_text="Last time MFA was successfully verified")

    class Meta:
        verbose_name_plural = 'User Profiles'

    def __str__(self):
        return f"{self.user.username} - {self.role}"

    @property
    def is_admin(self):
        return self.role == 'admin'

    @property
    def is_owner(self):
        return self.role == 'owner'

    @property
    def is_viewer(self):
        return self.role == 'viewer'

    def get_mfa_issuer(self):
        return 'TrustVault'

    def get_mfa_uri(self, user_email=None):
        """Generate TOTP URI for QR code provisioning."""
        if user_email is None:
            user_email = self.user.email
        return pyotp.TOTP(self.mfa_secret_key).provisioning_uri(
            user_email,
            issuer_name=self.get_mfa_issuer()
        )
