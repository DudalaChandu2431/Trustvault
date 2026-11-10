from django.urls import path
from . import views

urlpatterns = [
    # Document list and search
    path('', views.document_list, name='document_list'),
    path('search/', views.document_search, name='document_search'),
    
    # Document detail and access
    path('<int:document_id>/', views.document_detail, name='document_detail'),
    path('<int:document_id>/download/', views.document_download, name='document_download'),
    
    # Permission management
    path('<int:document_id>/grant/', views.grant_access, name='grant_access'),
    path('<int:document_id>/revoke/<int:user_id>/', views.revoke_access, name='revoke_access'),
    
    # API endpoints
    path('api/status/<int:document_id>/', views.api_document_status, name='api_document_status'),
    path('api/users/', views.api_user_list, name='api_user_list'),
    
    # Create document
    path('create/', views.document_create, name='document_create'),
]
