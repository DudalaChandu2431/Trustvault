"""
Security tests for TrustVault document platform.

These tests verify the three non-negotiable security principles:
1. A document is reachable only by someone who was granted it
2. You can prove who reached it - audit trail includes attempts that were refused
3. Taking access away works immediately - whatever was issued before stops working
"""

from django.test import TestCase
from django.contrib.auth import get_user_model
from django.urls import reverse
from rest_framework import status

from .models import Document, DocumentCategory, DocumentAccess, DocumentAccessLog, UserProfile


User = get_user_model()


class SecurityPrinciplesTest(TestCase):
    """Test the three non-negotiable security principles."""
    
    def setUp(self):
        """Set up test data."""
        self.admin_user = User.objects.create_superuser(
            'admin', 'admin@trustvault.local', 'adminpass123'
        )
        self.owner = User.objects.create_user(
            'owner1', 'owner1@trustvault.local', 'ownerpass123'
        )
        self.viewer1 = User.objects.create_user(
            'viewer1', 'viewer1@trustvault.local', 'viewerpass123'
        )
        self.viewer2 = User.objects.create_user(
            'viewer2', 'viewer2@trustvault.local', 'viewerpass123'
        )
        
        # Create user profiles
        admin_profile, _ = UserProfile.objects.get_or_create(
            user=self.admin_user, defaults={'role': 'admin'}
        )
        owner_profile, _ = UserProfile.objects.get_or_create(
            user=self.owner, defaults={'role': 'owner'}
        )
        viewer1_profile, _ = UserProfile.objects.get_or_create(
            user=self.viewer1, defaults={'role': 'viewer'}
        )
        viewer2_profile, _ = UserProfile.objects.get_or_create(
            user=self.viewer2, defaults={'role': 'viewer'}
        )
        
        # Create category and document
        self.category, _ = DocumentCategory.objects.get_or_create(
            name='Test Documents',
            description='Test category'
        )
        
        # Create a test document
        self.document = Document.objects.create(
            title='Confidential Document',
            description='A test confidential document',
            file=None,  # No actual file for unit tests
            owner=self.owner,
            category=self.category,
            status='published',
            is_public=False
        )
        
        # Create access grant
        self.access_grant = DocumentAccess.objects.create(
            document=self.document,
            user=self.viewer1,
            grant_type='read',
            granted_by=self.owner
        )
    
    # Principle 1: Document reachable only by granted user
    
    def test_principle_1_document_only_reachable_by_granted_user(self):
        """Principle 1: A document is reachable only by someone who was granted it."""
        # viewer2 should NOT have access to the document
        # Verify viewer2 has no DocumentAccess grant
        self.assertFalse(
            DocumentAccess.objects.filter(
                document=self.document, user=self.viewer2
            ).exists(),
            "viewer2 should not have access grant to this document"
        )
        
        # Verify check_document_access returns False for viewer2
        from documents.views import check_document_access
        has_access, grant_type, reason = check_document_access(
            self.viewer2, self.document, 'read'
        )
        self.assertFalse(has_access, "viewer2 should not have access to document")
        self.assertEqual(reason, 'No access grant found')
    
    def test_principle_1_owner_always_has_access(self):
        """Owners always have access to their own documents."""
        from documents.views import check_document_access
        has_access, grant_type, reason = check_document_access(
            self.owner, self.document, 'read'
        )
        self.assertTrue(has_access, "Owner should always have access")
        self.assertEqual(grant_type, 'owner')
    
    def test_principle_1_admin_has_access_everything(self):
        """Admins have access to everything."""
        from documents.views import check_document_access
        has_access, grant_type, reason = check_document_access(
            self.admin_user, self.document, 'read'
        )
        self.assertTrue(has_access, "Admin should have access to all documents")
        self.assertEqual(grant_type, 'admin')
    
    # Principle 2: Audit trail includes refused attempts
    
    def test_principle_2_audit_trail_refused_access(self):
        """Principle 2: You can prove who reached it - audit trail includes denied attempts."""
        from documents.models import DocumentAccessLog
        
        # viewer2 tries to access document - should be logged as denied
        self.client.force_login(self.viewer2)
        
        # Get the document detail - this should create a deny log entry
        response = self.client.get(reverse('document_detail', args=[self.document.id]))
        
        # Should have been redirected due to access denied
        self.assertNotEqual(response.status_code, 200)
        
        # Check that a deny log entry was created
        deny_logs = DocumentAccessLog.objects.filter(
            document=self.document,
            user=self.viewer2,
            action='deny'
        )
        self.assertTrue(
            deny_logs.exists(),
            "Should have a deny log entry for unauthorized access attempt"
        )
        
        # The deny log should have success=False
        for log in deny_logs:
            self.assertFalse(log.success, "Deny log should have success=False")
            self.assertIn('No access grant', log.reason)
    
    def test_principle_2_audit_include_successful_access(self):
        """Audit trail should also include successful access."""
        from documents.models import DocumentAccessLog
        
        # viewer1 has access - should create view log
        self.client.force_login(self.viewer1)
        response = self.client.get(reverse('document_detail', args=[self.document.id]))
        
        # Should have access log for successful view
        view_logs = DocumentAccessLog.objects.filter(
            document=self.document,
            user=self.viewer1,
            action='view',
            success=True
        )
        self.assertTrue(
            view_logs.exists(),
            "Should have a view log entry for authorized access"
        )
        
        # Verify the log details
        for log in view_logs:
            self.assertTrue(log.success, "View log should have success=True")
            self.assertIn('read access', log.reason)
    
    # Principle 3: Revoking access works immediately
    
    def test_principle_3_revoke_access_immediate(self):
        """Principle 3: Taking access away works immediately."""
        from documents.views import check_document_access
        
        # First verify viewer1 has access
        has_access, _, _ = check_document_access(
            self.viewer1, self.document, 'read'
        )
        self.assertTrue(has_access, "viewer1 should have access before revocation")
        
        # Revoke access by deleting the DocumentAccess grant
        DocumentAccess.objects.get(
            document=self.document, user=self.viewer1
        ).delete()
        
        # After deletion, viewer1 should NOT have access
        has_access, grant_type, reason = check_document_access(
            self.viewer1, self.document, 'read'
        )
        self.assertFalse(
            has_access, 
            "Access should be immediately revoked after deleting DocumentAccess grant"
        )
        self.assertEqual(reason, 'No access grant found')
    
    def test_principle_3_revoke_access_via_api(self):
        """Test revocation via the API endpoint."""
        from documents.models import DocumentAccessLog
        
        # Verify viewer1 has access initially
        self.client.force_login(self.viewer1)
        response = self.client.get(reverse('document_detail', args=[self.document.id]))
        self.assertEqual(response.status_code, 200)
        
        # Revoke access using the revoke_access view URL pattern
        revoke_response = self.client.post(
            reverse('revoke_access', args=[self.document.id, self.viewer1.id]),
            HTTP_X_REQUESTED_WITH='XMLHttpRequest'
        )
        
        self.assertEqual(revoke_response.status_code, 200)
        data = revoke_response.json()
        self.assertTrue(data['success'], "Revocation should succeed")
        self.assertTrue(data['access_revoked'], "Access should be marked as revoked")
        
        # Verify access is actually revoked
        has_access, _, _ = check_document_access(
            self.viewer1, self.document, 'read'
        )
        self.assertFalse(has_access, "Viewer1 should not have access after revocation")
        
        # Check that audit log was created for the revocation
        revoke_logs = DocumentAccessLog.objects.filter(
            document=self.document,
            action='share',
            reason__contains='Revoked'
        )
        self.assertTrue(
            revoke_logs.exists(),
            "Should have audit log entry for permission revocation"
        )


class AccessControlTest(TestCase):
    """Additional access control tests."""
    
    def setUp(self):
        self.admin_user = User.objects.create_superuser(
            'admin', 'admin@trustvault.local', 'adminpass123'
        )
        self.owner = User.objects.create_user(
            'owner1', 'owner1@trustvault.local', 'ownerpass123'
        )
        self.viewer1 = User.objects.create_user(
            'viewer1', 'viewer1@trustvault.local', 'viewerpass123'
        )
        self.viewer2 = User.objects.create_user(
            'viewer2', 'viewer2@trustvault.local', 'viewerpass123'
        )
        
        admin_profile, _ = UserProfile.objects.get_or_create(
            user=self.admin_user, defaults={'role': 'admin'}
        )
        owner_profile, _ = UserProfile.objects.get_or_create(
            user=self.owner, defaults={'role': 'owner'}
        )
        viewer1_profile, _ = UserProfile.objects.get_or_create(
            user=self.viewer1, defaults={'role': 'viewer'}
        )
        viewer2_profile, _ = UserProfile.objects.get_or_create(
            user=self.viewer2, defaults={'role': 'viewer'}
        )
        
        self.category, _ = DocumentCategory.objects.get_or_create(
            name='Test', description='Test'
        )
        
        self.document = Document.objects.create(
            title='Test Doc',
            description='Test',
            file=None,
            owner=self.owner,
            category=self.category,
            status='published',
            is_public=False
        )
    
    def test_viewer_cannot_access_another_viewers_document(self):
        """Viewer1 should not access viewer2's documents."""
        # viewer2 creates a document
        doc2 = Document.objects.create(
            title='Viewer2 Document',
            description='By viewer2',
            file=None,
            owner=self.viewer2,
            category=self.category,
            status='published',
            is_public=False
        )
        
        # viewer1 should not have access
        self.client.force_login(self.viewer1)
        response = self.client.get(reverse('document_detail', args=[doc2.id]))
        self.assertNotEqual(response.status_code, 200)
    
    def test_edited_grant_type_hierarchy(self):
        """Test that edit access grants more than read access."""
        from documents.views import check_document_access
        
        # Grant edit access to viewer1
        DocumentAccess.objects.create(
            document=self.document,
            user=self.viewer1,
            grant_type='edit',
            granted_by=self.owner
        )
        
        # viewer1 should have edit access (can view)
        has_access, grant_type, reason = check_document_access(
            self.viewer1, self.document, 'read'
        )
        self.assertTrue(has_access, "Edit grant should allow read access")
        
        # viewer1 should also pass edit-required checks
        has_access_edit, _, _ = check_document_access(
            self.viewer1, self.document, 'edit'
        )
        self.assertTrue(has_access_edit, "Edit grant should allow edit access")
    
    def test_expired_access_grant(self):
        """Test that expired access grants are properly denied."""
        from documents.models import DocumentAccess
        from datetime import timedelta
        from django.utils import timezone
        
        # Create access grant with expiration
        expired_grant = DocumentAccess.objects.create(
            document=self.document,
            user=self.viewer1,
            grant_type='read',
            granted_by=self.owner,
            expires_at=timezone.now() - timedelta(days=1)  # Already expired
        )
        
        # Access should be denied for expired grant
        has_access, grant_type, reason = check_document_access(
            self.viewer1, self.document, 'read'
        )
        self.assertFalse(has_access, "Expired grant should be denied")
        self.assertIn('expired', reason.lower())
