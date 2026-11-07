from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"

class UserRegister(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str = Field(..., min_length=8)
    role: Optional[str] = "USER"

class UserLogin(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    id: int
    email: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

class DocumentResponse(BaseModel):
    id: str
    filename: str
    mime_type: str
    file_size: int
    sha256_hash: str
    key_version: int
    owner_id: int
    created_at: datetime

    class Config:
        from_attributes = True

class PermissionCreate(BaseModel):
    user_email: str = Field(..., pattern=EMAIL_REGEX)
    permission_type: str = "READ"

class PermissionResponse(BaseModel):
    id: int
    document_id: str
    user_id: int
    user_email: Optional[str] = None
    permission_type: str
    status: str
    granted_by: int
    granted_at: datetime
    revoked_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class AuditLogResponse(BaseModel):
    id: int
    sequence: int
    timestamp: datetime
    actor_id: Optional[int]
    action: str
    target_type: str
    target_id: Optional[str]
    payload_json: str
    previous_hash: str
    record_hash: str

    class Config:
        from_attributes = True
