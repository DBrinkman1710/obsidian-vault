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
from app.core.models import Tenant, User, UserRole, UserSignature
from app.core.schemas import (
    MAX_SIGNATURE_BODY_CHARS,
    SignatureCreate,
    SignatureOut,
    SignatureUpdate,
    UserOut,
)
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
    await db.flush()

    # Auto-assign any RBAC roles that were selected at invite time.
    rbac_role_ids = claims.get("rbac_role_ids") or []
    if rbac_role_ids:
        from app.modules.rbac.service import assign_user_rbac_role
        for role_id_str in rbac_role_ids:
            try:
                await assign_user_rbac_role(db, uuid.UUID(claims["tenant_id"]), user.id, uuid.UUID(role_id_str))
            except Exception:
                pass  # skip invalid/deleted roles silently

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
    hotkeys_enabled: Optional[bool] = None
    shared_inbox_disabled: Optional[bool] = None
    contact_column_prefs: Optional[list[dict]] = None
    sidebar_order: Optional[list[str]] = None
    send_from_aliases: Optional[list[str]] = None
    tour_completed: Optional[bool] = None
    setup_checklist_dismissed: Optional[bool] = None


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
    if body.hotkeys_enabled is not None:
        current_user.hotkeys_enabled = body.hotkeys_enabled
    if body.shared_inbox_disabled is not None:
        current_user.shared_inbox_disabled = body.shared_inbox_disabled
    if "contact_column_prefs" in body.model_fields_set:
        current_user.contact_column_prefs = body.contact_column_prefs
    if "sidebar_order" in body.model_fields_set:
        current_user.sidebar_order = body.sidebar_order
    if "send_from_aliases" in body.model_fields_set:
        current_user.send_from_aliases = body.send_from_aliases or []
    if body.tour_completed is not None:
        current_user.tour_completed = body.tour_completed
    if body.setup_checklist_dismissed is not None:
        current_user.setup_checklist_dismissed = body.setup_checklist_dismissed
    await db.commit()
    await db.refresh(current_user)
    return UserOut.model_validate(current_user)


# --- Multi-signature CRUD (S1) ----------------------------------------------
# All routes are scoped to the current user; RLS (set_tenant_context in the
# CurrentUser dependency) additionally guarantees tenant isolation.

SIGNATURES_PREFIX = "/me/signatures"


def _validate_signature_body(body: str) -> None:
    if len(body) > MAX_SIGNATURE_BODY_CHARS:
        # An embedded image (S2) pushed the signature over the inline size cap.
        raise HTTPException(
            status_code=400,
            detail="Signature is too large — embedded images must be 500 KB or smaller.",
        )


async def _load_user_signatures(db: AsyncSession, user_id: uuid.UUID) -> list[UserSignature]:
    result = await db.execute(
        select(UserSignature)
        .where(UserSignature.user_id == user_id)
        .order_by(UserSignature.display_order, UserSignature.created_at)
    )
    return list(result.scalars().all())


@router.get("/me/signatures", response_model=list[SignatureOut])
async def list_signatures(current_user: CurrentUser, db: Annotated[AsyncSession, Depends(get_db)]):
    return await _load_user_signatures(db, current_user.id)


@router.post("/me/signatures", response_model=SignatureOut, status_code=status.HTTP_201_CREATED)
async def create_signature(
    body: SignatureCreate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    _validate_signature_body(body.body)
    existing = await _load_user_signatures(db, current_user.id)
    sig = UserSignature(
        user_id=current_user.id,
        tenant_id=current_user.tenant_id,
        name=(body.name or "").strip() or "Untitled",
        body=body.body,
        # First signature a user creates becomes their default automatically.
        is_default=len(existing) == 0,
        display_order=(max((s.display_order for s in existing), default=-1) + 1),
    )
    db.add(sig)
    await db.commit()
    await db.refresh(sig)
    return sig


@router.patch("/me/signatures/{signature_id}", response_model=SignatureOut)
async def update_signature(
    signature_id: uuid.UUID,
    body: SignatureUpdate,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    sig = await db.get(UserSignature, signature_id)
    if sig is None or sig.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Signature not found")

    if body.body is not None:
        _validate_signature_body(body.body)
        sig.body = body.body
    if body.name is not None:
        sig.name = body.name.strip() or "Untitled"
    if body.display_order is not None:
        sig.display_order = body.display_order
    if body.is_default is not None:
        if body.is_default:
            # Exactly one default per user: unset all others first.
            for other in await _load_user_signatures(db, current_user.id):
                if other.id != sig.id and other.is_default:
                    other.is_default = False
            sig.is_default = True
        else:
            sig.is_default = False

    await db.commit()
    await db.refresh(sig)
    return sig


@router.delete("/me/signatures/{signature_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_signature(
    signature_id: uuid.UUID,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    sig = await db.get(UserSignature, signature_id)
    if sig is None or sig.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Signature not found")
    was_default = sig.is_default
    await db.delete(sig)
    await db.flush()
    # Keep a default alive: if we removed the default, promote the next one.
    if was_default:
        remaining = await _load_user_signatures(db, current_user.id)
        if remaining:
            remaining[0].is_default = True
    await db.commit()
    return None
