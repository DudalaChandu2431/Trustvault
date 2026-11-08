import secrets
import hashlib
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models import User, RoleEnum, PasswordResetOTP
from app.schemas import (
    UserRegister,
    UserLogin,
    TokenResponse,
    UserResponse,
    ForgotPasswordRequest,
    VerifyOTPRequest,
    VerifyOTPResponse,
    ResetPasswordRequest,
    ChangePasswordRequest,
    MessageResponse
)
from app.auth import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
    revoke_token,
    extract_token_from_request
)
from app.encryption import log_audit_event
from app.rate_limiter import rate_limit

router = APIRouter(prefix="/api/v1/auth", tags=["Authentication"])

@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(rate_limit(max_requests=5, window_seconds=60))]
)
async def register(user_data: UserRegister, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == user_data.email))
    existing = result.scalars().first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    hashed_pwd = hash_password(user_data.password)
    user = User(
        email=user_data.email,
        password_hash=hashed_pwd,
        role=user_data.role if user_data.role in [RoleEnum.ADMIN, RoleEnum.USER] else RoleEnum.USER
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    await log_audit_event(
        db=db,
        actor_id=user.id,
        action="USER_REGISTER",
        target_type="User",
        target_id=str(user.id),
        payload={"email": user.email, "role": user.role}
    )

    return user

@router.post(
    "/login",
    response_model=TokenResponse,
    dependencies=[Depends(rate_limit(max_requests=10, window_seconds=60))]
)
async def login(credentials: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email))
    user = result.scalars().first()

    now = datetime.utcnow()
    
    if user and user.locked_until and user.locked_until > now:
        remaining_seconds = int((user.locked_until - now).total_seconds())
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account locked due to excessive failed attempts. Try again in {remaining_seconds // 60 + 1} minutes or reset password."
        )

    if not user or not verify_password(credentials.password, user.password_hash):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= 5:
                user.locked_until = now + timedelta(minutes=15)
                await log_audit_event(
                    db=db,
                    actor_id=user.id,
                    action="ACCOUNT_LOCKED_BRUTEFORCE",
                    target_type="User",
                    target_id=str(user.id),
                    payload={"email": user.email, "failed_attempts": user.failed_login_attempts}
                )
            else:
                await log_audit_event(
                    db=db,
                    actor_id=user.id,
                    action="LOGIN_FAILED",
                    target_type="User",
                    target_id=str(user.id),
                    payload={"email": user.email, "failed_attempts": user.failed_login_attempts}
                )
            await db.commit()
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    # Successful login: reset failed counters
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    access_token = create_access_token(data={"sub": user.email})

    await log_audit_event(
        db=db,
        actor_id=user.id,
        action="USER_LOGIN",
        target_type="User",
        target_id=str(user.id),
        payload={"email": user.email}
    )

    return {"access_token": access_token, "token_type": "bearer"}

@router.post(
    "/forgot-password",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit(max_requests=5, window_seconds=300))]
)
async def forgot_password(req: ForgotPasswordRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()

    generic_msg = "If your email is registered in TrustVault, a 6-digit cryptographic verification code has been dispatched."
    
    if not user:
        return {"message": generic_msg}

    otp = str(secrets.randbelow(900000) + 100000)
    otp_hash = hashlib.sha256(otp.encode()).hexdigest()

    existing_otps = await db.execute(
        select(PasswordResetOTP).where(
            PasswordResetOTP.user_id == user.id,
            PasswordResetOTP.is_used == 0
        )
    )
    for old_otp in existing_otps.scalars().all():
        old_otp.is_used = 1

    reset_record = PasswordResetOTP(
        user_id=user.id,
        otp_hash=otp_hash,
        expires_at=datetime.utcnow() + timedelta(minutes=10)
    )
    db.add(reset_record)
    await db.commit()

    await log_audit_event(
        db=db,
        actor_id=user.id,
        action="PASSWORD_RESET_REQUESTED",
        target_type="User",
        target_id=str(user.id),
        payload={"email": user.email}
    )

    return {"message": f"{generic_msg} (Dev Code: {otp})"}

@router.post(
    "/verify-otp",
    response_model=VerifyOTPResponse,
    dependencies=[Depends(rate_limit(max_requests=6, window_seconds=60))]
)
async def verify_otp(req: VerifyOTPRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == req.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=400, detail="Invalid request")

    now = datetime.utcnow()
    otp_result = await db.execute(
        select(PasswordResetOTP).where(
            PasswordResetOTP.user_id == user.id,
            PasswordResetOTP.is_used == 0,
            PasswordResetOTP.expires_at > now
        ).order_by(PasswordResetOTP.created_at.desc())
    )
    active_otp = otp_result.scalars().first()

    if not active_otp:
        raise HTTPException(status_code=400, detail="No active or valid OTP found. Please request a new one.")

    active_otp.attempts += 1
    if active_otp.attempts > 3:
        active_otp.is_used = 1
        await db.commit()
        await log_audit_event(
            db=db,
            actor_id=user.id,
            action="OTP_BRUTEFORCE_EXCEEDED",
            target_type="User",
            target_id=str(user.id),
            payload={"email": user.email}
        )
        raise HTTPException(status_code=403, detail="Maximum OTP verification attempts exceeded. Code invalidated.")

    submitted_hash = hashlib.sha256(req.otp.encode()).hexdigest()
    if submitted_hash != active_otp.otp_hash:
        await db.commit()
        remaining = 3 - active_otp.attempts
        raise HTTPException(status_code=400, detail=f"Invalid OTP code. {remaining} attempt(s) remaining.")

    reset_token = secrets.token_urlsafe(32)
    active_otp.reset_token = reset_token
    active_otp.is_used = 1
    await db.commit()

    await log_audit_event(
        db=db,
        actor_id=user.id,
        action="OTP_VERIFIED",
        target_type="User",
        target_id=str(user.id),
        payload={"email": user.email}
    )

    return VerifyOTPResponse(reset_token=reset_token)

@router.post(
    "/reset-password",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit(max_requests=5, window_seconds=60))]
)
async def reset_password(req: ResetPasswordRequest, db: AsyncSession = Depends(get_db)):
    now = datetime.utcnow()
    result = await db.execute(
        select(PasswordResetOTP).where(
            PasswordResetOTP.reset_token == req.reset_token,
            PasswordResetOTP.expires_at > now
        )
    )
    record = result.scalars().first()
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset token.")

    user_result = await db.execute(select(User).where(User.id == record.user_id))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=400, detail="User not found")

    user.password_hash = hash_password(req.new_password)
    user.failed_login_attempts = 0
    user.locked_until = None
    record.reset_token = None
    await db.commit()

    await log_audit_event(
        db=db,
        actor_id=user.id,
        action="PASSWORD_RESET_COMPLETED",
        target_type="User",
        target_id=str(user.id),
        payload={"email": user.email}
    )

    return {"message": "Password reset successfully. You can now log in with your new password."}

@router.post(
    "/change-password",
    response_model=MessageResponse,
    dependencies=[Depends(rate_limit(max_requests=5, window_seconds=60))]
)
async def change_password(
    req: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if not verify_password(req.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect.")

    current_user.password_hash = hash_password(req.new_password)
    await db.commit()

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="PASSWORD_CHANGED",
        target_type="User",
        target_id=str(current_user.id),
        payload={"email": current_user.email}
    )

    return {"message": "Password changed successfully."}

@router.post("/logout", response_model=MessageResponse)
async def logout(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    raw_token = extract_token_from_request(request)
    if raw_token:
        await revoke_token(raw_token, current_user.id, db)

    await log_audit_event(
        db=db,
        actor_id=current_user.id,
        action="USER_LOGOUT",
        target_type="User",
        target_id=str(current_user.id),
        payload={"email": current_user.email}
    )

    return {"message": "Session revoked and successfully logged out."}

@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
