from django.contrib import admin
from .models import DocumentCategory, Document, DocumentAccess, DocumentAccessLog, UserProfile


@admin.register(DocumentCategory)
class DocumentCategoryAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_at']
    search_fields = ['name', 'description']
    ordering = ['name']


@admin.register(Document)
class DocumentAdmin(admin.ModelAdmin):
    list_display = ['title', 'owner', 'category', 'status', 'created_at', 'is_public']
    list_filter = ['status', 'category', 'is_public', 'created_at']
    search_fields = ['title', 'description', 'owner__username']
    readonly_fields = ['created_at', 'updated_at', 'uploaded_at']
    fieldsets = (
        (None, {
            'fields': ('title', 'description', 'file', 'owner', 'category', 'status')
        }),
        ('Audit', {
            'fields': ('is_public', 'version'),
            'classes': ('collapse',),
        }),
    )


@admin.register(DocumentAccess)
class DocumentAccessAdmin(admin.ModelAdmin):
    list_display = ['document', 'user', 'grant_type', 'granted_by', 'granted_at']
    list_filter = ['grant_type', 'granted_at']
    search_fields = ['document__title', 'user__username', 'granted_by__username']
    raw_id_fields = ['document', 'user', 'granted_by']


@admin.register(DocumentAccessLog)
class DocumentAccessLogAdmin(admin.ModelAdmin):
    list_display = ['document', 'user', 'action', 'success', 'timestamp']
    list_filter = ['action', 'success', 'timestamp']
    search_fields = ['document__title', 'user__username', 'reason']
    readonly_fields = ['timestamp']
    date_hierarchy = 'timestamp'


@admin.register(UserProfile)
class UserProfileAdmin(admin.ModelAdmin):
    list_display = ['user', 'role', 'department', 'is_admin', 'is_owner', 'is_viewer']
    list_filter = ['role']
    search_fields = ['user__username', 'department']
    raw_id_fields = ['user']
