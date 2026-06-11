from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from pydantic import BaseModel
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.email_html import render_email_html
from app.core.mailer import ResendNotConfiguredError, send_email
from app.core.models import Tenant, User, UserRole
from app.core.schemas import UserOut
from app.database import get_db
from app.auth.dependencies import CurrentUser
from app.auth.tokens import create_signed_token, verify_signed_token

router = APIRouter(prefix="/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


def create_access_token(user_id: str, settings, expires: Optional[timedelta] = None, **extra) -> str:
    expire = datetime.now(timezone.utc) + (expires or timedelta(minutes=settings.access_token_expire_minutes))
    return jwt.encode({"sub": user_id, "exp": expire, **extra}, settings.secret_key, algorithm=settings.algorithm)


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    result = await db.execute(select(User).where(func.lower(User.email) == body.email.strip().lower()))
    user = result.scalar_one_or_none()

    if not user or not pwd_context.verify(body.password, user.hashed_password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")
    if user.role != UserRole.superadmin:
        tenant = await db.get(Tenant, user.tenant_id)
        if tenant is None or not tenant.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This workspace is inactive")

    await db.execute(
        update(User).where(User.id == user.id).values(last_login_at=datetime.now(timezone.utc))
    )
    await db.commit()

    settings = get_settings()
    token = create_access_token(str(user.id), settings)
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser):
    return UserOut.model_validate(current_user)


class RegisterRequest(BaseModel):
    token: str
    password: str
    full_name: Optional[str] = None


@router.post("/register", response_model=TokenResponse)
async def register(body: RegisterRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    """Create an account from an invite token; the invitee sets their own password."""
    claims = verify_signed_token(body.token, "invite")
    if not claims:
        raise HTTPException(status_code=400, detail="Invalid or expired invite link")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    email = claims["email"]
    existing = await db.scalar(select(User).where(User.email == email))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists — log in instead")

    user = User(
        tenant_id=uuid.UUID(claims["tenant_id"]),
        email=email,
        full_name=(body.full_name or claims.get("full_name") or "User").strip(),
        hashed_password=pwd_context.hash(body.password),
        role=UserRole(claims.get("role", "agent")),
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    token = create_access_token(str(user.id), get_settings())
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    """Always returns ok — never reveals whether the email has an account."""
    user = await db.scalar(select(User).where(User.email == body.email.lower().strip()))
    if user and user.is_active:
        settings = get_settings()
        token = create_signed_token("reset", timedelta(hours=1), sub=str(user.id))
        link = f"{settings.app_base_url}/reset-password?token={token}"
        try:
            reset_body = (
                f"Hi {user.full_name},\n\n"
                f"Reset your password here:\n{link}\n\n"
                f"This link is valid for 1 hour. If you didn't request this, you can ignore it."
            )
            await send_email(
                to=user.email,
                subject="Reset your Yippie password",
                body=reset_body,
                html=render_email_html(reset_body, tenant_name="Yippie"),
            )
        except ResendNotConfiguredError:
            pass
    return {"ok": True}


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest, db: Annotated[AsyncSession, Depends(get_db)]):
    claims = verify_signed_token(body.token, "reset")
    if not claims:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    user = await db.get(User, uuid.UUID(claims["sub"]))
    if user is None or not user.is_active:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    user.hashed_password = pwd_context.hash(body.new_password)
    await db.commit()
    return {"ok": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.patch("/me/password")
async def change_password(
    body: ChangePasswordRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if not pwd_context.verify(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    current_user.hashed_password = pwd_context.hash(body.new_password)
    await db.commit()
    return {"ok": True}


class UserSelfUpdate(BaseModel):
    full_name: Optional[str] = None
    reply_from_email: Optional[str] = None
    inbound_email: Optional[str] = None
    email_signature: Optional[str] = None


@router.patch("/me", response_model=UserOut)
async def update_me(
    body: UserSelfUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    if body.full_name is not None:
        current_user.full_name = body.full_name.strip()
    if "email_signature" in body.model_fields_set:
        current_user.email_signature = (body.email_signature or "").strip() or None
    if "reply_from_email" in body.model_fields_set:
        current_user.reply_from_email = body.reply_from_email or None
    if "inbound_email" in body.model_fields_set:
        addr = (body.inbound_email or "").lower().strip()
        if addr:
            # Must be on the Resend receiving domain — mail to other domains never reaches the poller
            local = addr.removesuffix("@getyippie.com")
            if local == addr or not local or "@" in local:
                raise HTTPException(status_code=400, detail="Personal inbox address must be on @getyippie.com")
            taken_user = await db.execute(
                select(User.id).where(User.inbound_email == addr, User.id != current_user.id)
            )
            taken_tenant = await db.execute(select(Tenant.id).where(Tenant.inbound_email == addr))
            if taken_user.scalar_one_or_none() or taken_tenant.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="That inbox address is already in use")
            current_user.inbound_email = addr
        else:
            current_user.inbound_email = None
    await db.commit()
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)
