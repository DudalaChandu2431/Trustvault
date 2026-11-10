import re
from pydantic import BaseModel, Field, field_validator, model_validator
from datetime import datetime
from typing import Optional

EMAIL_REGEX = r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$"

def validate_password_complexity(v: str) -> str:
    if v != v.strip():
        raise ValueError("Password cannot start or end with spaces")
    if len(v) < 12:
        raise ValueError("Password must be at least 12 characters long")
    if not re.search(r"[A-Z]", v):
        raise ValueError("Password must contain at least 1 uppercase letter (A-Z)")
    if not re.search(r"[a-z]", v):
        raise ValueError("Password must contain at least 1 lowercase letter (a-z)")
    if not re.search(r"\d", v):
        raise ValueError("Password must contain at least 1 number (0-9)")
    if not re.search(r"[@#$%&*!]", v):
        raise ValueError("Password must contain at least 1 special character (@#$%&*!)")
    return v

class UserRegister(BaseModel):
    email: str = Field(..., pattern=EMAIL_REGEX)
    password: str = Field(..., min_length=12, description="Min 12 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special (@#$%&*!)")
    confirm_password: Optional[str] = None
    role: Optional[str] = "USER"

    @field_validator("password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_complexity(v)

    @model_validator(mode="after")
    def check_passwords_match(self):
        if self.confirm_password is not None and self.password != self.confirm_password:
            raise ValueError("Passwords do not match")
        return self

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
    new_password: str = Field(..., min_length=12, description="Min 12 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special (@#$%&*!)")

    @field_validator("new_password")
    @classmethod
    def check_password(cls, v: str) -> str:
        return validate_password_complexity(v)

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(..., min_length=12, description="Min 12 chars, 1 uppercase, 1 lowercase, 1 digit, 1 special (@#$%&*!)")

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
