# API Design

## Authentication Endpoints
- `POST /api/v1/auth/register`: Register user account.
- `POST /api/v1/auth/login`: Login, returns JWT access token + sets HttpOnly refresh cookie.
- `POST /api/v1/auth/refresh`: Rotate refresh token, issue new access token.
- `POST /api/v1/auth/logout`: Revoke session in DB, clear cookie.

## Document Endpoints
- `GET /api/v1/documents`: List accessible documents (Owned or explicit ACL read/edit).
- `POST /api/v1/documents`: Upload document (Owner). MIME validation, encryption at rest.
- `GET /api/v1/documents/{id}`: Get metadata (Owner, explicit ACL read/edit).
- `GET /api/v1/documents/{id}/download`: Stream decrypted file contents (Owner, explicit ACL read/edit).
- `PUT /api/v1/documents/{id}`: Update document metadata (Owner, explicit ACL edit).
- `DELETE /api/v1/documents/{id}`: Delete document (Owner).

## Permission Endpoints
- `POST /api/v1/documents/{id}/permissions`: Grant access (read/edit) to user (Owner).
- `DELETE /api/v1/documents/{id}/permissions/{user_id}`: Revoke access immediately (Owner).
- `GET /api/v1/documents/{id}/permissions`: View active ACL (Owner).

## Audit & Admin Endpoints
- `GET /api/v1/audit/logs`: Query audit events (Admin only).
- `POST /api/v1/audit/verify`: Trigger hash-chain integrity verification (Admin only).
- `GET /api/v1/admin/users`: Manage user roles (Admin only).
