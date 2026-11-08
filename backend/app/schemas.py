import re
from pydantic import BaseModel, Field, field_validator
from datetime import datetime
from typing import Optional

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"

def validate_password_complexity(v: str) -> str:
    if len(v) < 8:
        raise ValueError("Password must be at least 8 characters long")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain at least one uppercase letter")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password must contain at least one lowercase letter")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain at least one number")
    if not re.search(r"[@$!%*?&#^_\-+=]", v):
        raise ValueError("Password must contain at least one special character (@$!%*?&#^_-+=)")
    return v

class UserRegister(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str = Field(..., min_length=8, description="Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char")
    role: Optional[str] = "USER"

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_complexity(v)

class UserLogin(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str

class ForgotPasswordRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)

class VerifyOTPRequest(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    otp: str = Field(..., min_length=6, max_length=6)

class VerifyOTPResponse(BaseModel):
    reset_token: str
    message: str = "OTP verified successfully. Use this token to reset your password."

class ResetPasswordRequest(BaseModel):
    reset_token: str
    new_password: str = Field(..., min_length=8, description="Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char")

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_complexity(v)

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=8, description="Min 8 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special char")

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_complexity(v)

class MessageResponse(BaseModel):
    message: str

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
