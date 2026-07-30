from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

import bcrypt as _bcrypt
import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel

log = logging.getLogger(__name__)
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
from app.core.rate_limit import get_client_ip, rl_hit, rl_is_blocked

router = APIRouter(prefix="/auth", tags=["auth"])

# Pre-computed dummy hash used to equalise login timing for unknown emails,
# preventing user enumeration via response-time side-channel.
_DUMMY_HASH = b"$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewY2v1aOHBzJXHni"

async def _check_password(password: str, hashed: str | bytes) -> bool:
    """bcrypt is ~100-300ms of pure CPU — run it off the event loop so one
    login attempt doesn't stall every concurrent request and websocket."""
    if isinstance(hashed, str):
        hashed = hashed.encode()
    return await asyncio.to_thread(_bcrypt.checkpw, password.encode(), hashed)


async def _hash_password(password: str) -> str:
    hashed = await asyncio.to_thread(_bcrypt.hashpw, password.encode(), _bcrypt.gensalt())
    return hashed.decode()


_LOGIN_WINDOW = 15 * 60
_LOGIN_LIMIT = 10
_RESET_WINDOW = 5 * 60
_RESET_LIMIT = 5
_REGISTER_WINDOW = 15 * 60
_REGISTER_LIMIT = 10


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class UserResponse(BaseModel):
    user: UserOut


def _set_auth_cookie(response: Response, token: str, settings) -> None:
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite=settings.cookie_samesite,
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )


def create_access_token(user_id: str, settings, expires: Optional[timedelta] = None, **extra) -> str:
    expire = datetime.now(timezone.utc) + (expires or timedelta(minutes=settings.access_token_expire_minutes))
    return jwt.encode({"sub": user_id, "exp": expire, **extra}, settings.secret_key, algorithm=settings.algorithm)


@router.post("/login", response_model=UserResponse)
async def login(body: LoginRequest, request: Request, response: Response, db: Annotated[AsyncSession, Depends(get_db)]):
    ip = get_client_ip(request)
    if await rl_is_blocked(f"login:{ip}", _LOGIN_LIMIT, _LOGIN_WINDOW):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Too many failed login attempts. Try again later.")
    result = await db.execute(select(User).where(func.lower(User.email) == body.email.strip().lower()))
    user = result.scalar_one_or_none()

    if not user:
        await _check_password(body.password, _DUMMY_HASH)  # equalise timing — prevents user enumeration
        await rl_hit(f"login:{ip}", _LOGIN_WINDOW)
        log.warning("AUTH_LOGIN_FAIL email=%s ip=%s", body.email.strip().lower(), ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    if not await _check_password(body.password, user.hashed_password):
        await rl_hit(f"login:{ip}", _LOGIN_WINDOW)
        log.warning("AUTH_LOGIN_FAIL email=%s ip=%s", body.email.strip().lower(), ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        # An inactive user who has never logged in is a self-serve signup that
        # hasn't clicked their verification email yet (accounts are created
        # inactive until verified) — point them at their inbox instead of the
        # dead-end "deactivated" message.
        if user.last_login_at is None:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Check your inbox to activate your account — we sent you a verification email when you signed up.",
            )
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")
    if user.role != UserRole.superadmin:
        tenant = await db.get(Tenant, user.tenant_id)
        if tenant is None or not tenant.is_active:
            detail = "This workspace is inactive"
            # [TRIAL30] Distinguish trial expiry — the hourly trial_expiry_check
            # job deactivates unconverted tenants once trial_ends_at passes.
            if tenant is not None and tenant.trial_ends_at is not None:
                trial_end = tenant.trial_ends_at
                if trial_end.tzinfo is None:
                    trial_end = trial_end.replace(tzinfo=timezone.utc)
                if trial_end < datetime.now(timezone.utc):
                    detail = (
                        "Your free trial has ended — check your email for reactivation options, "
                        "or contact support@getyippie.com"
                    )
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=detail)

    await db.execute(
        update(User).where(User.id == user.id).values(last_login_at=datetime.now(timezone.utc))
    )
    await db.commit()

    settings = get_settings()
    token = create_access_token(str(user.id), settings)
    _set_auth_cookie(response, token, settings)
    log.info("AUTH_LOGIN_SUCCESS user_id=%s email=%s ip=%s", user.id, user.email, ip)
    return UserResponse(user=UserOut.model_validate(user))


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.post("/refresh", include_in_schema=False)
async def refresh_token(request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Re-issue the access token cookie if the current token is still valid.
    Called by the frontend periodically to prevent mid-session expiry."""
    settings = get_settings()
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    user = await db.get(User, payload["sub"])
    if user is None or not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account deactivated")
    if user.role != UserRole.superadmin:
        tenant = await db.get(Tenant, user.tenant_id)
        if tenant is None or not tenant.is_active:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="This workspace is inactive")
    if payload.get("imp"):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Cannot refresh an impersonation token")
    extra = {k: v for k, v in payload.items() if k not in ("sub", "exp", "iat", "nbf")}
    new_token = create_access_token(payload["sub"], settings, **extra)
    _set_auth_cookie(response, new_token, settings)
    return {"ok": True}


@router.get("/me", response_model=UserOut)
async def me(current_user: CurrentUser):
    return UserOut.model_validate(current_user)


class RegisterRequest(BaseModel):
    token: str
    password: str
    full_name: Optional[str] = None


@router.post("/register", response_model=UserResponse)
async def register(body: RegisterRequest, request: Request, response: Response, db: Annotated[AsyncSession, Depends(get_db)]):
    """Create an account from an invite token; the invitee sets their own password."""
    _ip = get_client_ip(request)
    if await rl_is_blocked(f"register:{_ip}", _REGISTER_LIMIT, _REGISTER_WINDOW):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Too many registration attempts. Try again later.")
    await rl_hit(f"register:{_ip}", _REGISTER_WINDOW)
    claims = verify_signed_token(body.token, "invite")
    if not claims:
        raise HTTPException(status_code=400, detail="Invalid or expired invite link")
    if len(body.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")

    # Emails are stored lowercase — login matches on lower(email), so a
    # mixed-case duplicate here would make that lookup raise MultipleResultsFound.
    email = claims["email"].strip().lower()
    existing = await db.scalar(select(User).where(func.lower(User.email) == email))
    if existing:
        raise HTTPException(status_code=409, detail="An account with this email already exists. Log in instead.")

    user = User(
        tenant_id=uuid.UUID(claims["tenant_id"]),
        email=email,
        full_name=(body.full_name or claims.get("full_name") or "User").strip(),
        hashed_password=await _hash_password(body.password),
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

    settings = get_settings()
    token = create_access_token(str(user.id), settings)
    _set_auth_cookie(response, token, settings)
    return UserResponse(user=UserOut.model_validate(user))


class ForgotPasswordRequest(BaseModel):
    email: str


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest, request: Request, db: Annotated[AsyncSession, Depends(get_db)]):
    """Always returns ok — never reveals whether the email has an account."""
    _ip = get_client_ip(request)
    if await rl_is_blocked(f"reset:{_ip}", _RESET_LIMIT, _RESET_WINDOW):
        raise HTTPException(status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                            detail="Too many password reset requests. Try again later.")
    await rl_hit(f"reset:{_ip}", _RESET_WINDOW)
    user = await db.scalar(select(User).where(func.lower(User.email) == body.email.lower().strip()))
    if user and user.is_active:
        settings = get_settings()
        token = create_signed_token("reset", timedelta(hours=1), sub=str(user.id), phash=(user.hashed_password or "")[-8:])
        # effective_base_url falls back to the ENVIRONMENT-derived URL when
        # APP_BASE_URL is unset — a bare app_base_url would produce a relative
        # (dead) link in the email.
        link = f"{settings.effective_base_url}/reset-password?token={token}"
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
    # Invalidate the token by verifying it was minted against the current password
    # hash. Any prior reset (which changes the hash) renders outstanding tokens stale.
    if claims.get("phash") != (user.hashed_password or "")[-8:]:
        raise HTTPException(status_code=400, detail="Invalid or expired reset link")
    user.hashed_password = await _hash_password(body.new_password)
    # Choosing a password through any path clears the signup auto password obligation.
    user.needs_password = False
    await db.commit()
    return {"ok": True}


class SetInitialPasswordRequest(BaseModel):
    new_password: str


@router.post("/set-initial-password")
async def set_initial_password(
    body: SetInitialPasswordRequest,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    """One-time password creation for accounts provisioned with an auto-generated
    password (passwordless signup). The session itself came from the emailed
    entry link, so possession of the session proves inbox ownership — the same
    trust model as the reset-token flow."""
    if not current_user.needs_password:
        # Closed once a password has been chosen — this endpoint must not act
        # as a change password bypass (that path requires the current password).
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="A password is already set for this account")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    current_user.hashed_password = await _hash_password(body.new_password)
    current_user.needs_password = False
    await db.commit()
    log.info("AUTH_PASSWORD_SET_INITIAL user_id=%s", current_user.id)
    return {"ok": True}


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.patch("/me/password")
async def change_password(
    body: ChangePasswordRequest,
    request: Request,
    current_user: CurrentUser,
    db: Annotated[AsyncSession, Depends(get_db)],
):
    # get_current_user stashes the verified claims of the token that actually
    # authenticated this request (cookie-first, header fallback) — checking the
    # Authorization header here would miss cookie-delivered impersonation tokens.
    token_claims = getattr(request.state, "token_claims", None) or {}
    if token_claims.get("imp"):
        raise HTTPException(status_code=403, detail="Password changes are blocked in impersonation sessions")
    if not await _check_password(body.current_password, current_user.hashed_password):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Current password is incorrect")
    if len(body.new_password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    current_user.hashed_password = await _hash_password(body.new_password)
    # Choosing a password through any path clears the signup auto password obligation.
    current_user.needs_password = False
    await db.commit()
    log.warning("AUTH_PASSWORD_CHANGE user_id=%s ip=%s", current_user.id, get_client_ip(request))
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
    ui_language: Optional[str] = None
    jarvis_prefs: Optional[dict] = None
    help_tips_enabled: Optional[bool] = None


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
        addr = (body.reply_from_email or "").strip()
        if addr:
            import re as _re
            if not _re.match(r"^[^@]+@[^@]+\.[^@]+$", addr):
                raise HTTPException(status_code=400, detail="Reply-from address must be a valid email address")
            current_user.reply_from_email = addr.lower()
        else:
            current_user.reply_from_email = None
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
        aliases = body.send_from_aliases or []
        if aliases:
            from app.core.mailer import email_domain as _email_domain, is_valid_email as _is_valid_email
            from app.modules.email_accounts.models import EmailAccount as _EA
            tenant = await db.get(Tenant, current_user.tenant_id)
            # When the user has an active linked account the alias goes out via
            # that provider (From override), so the Resend domain restriction
            # does not apply — any valid address is permitted.
            has_linked = await db.scalar(
                select(_EA.id).where(
                    _EA.tenant_id == current_user.tenant_id,
                    _EA.status == "active",
                ).limit(1)
            )
            allowed: set[str] = set()
            if not has_linked:
                if tenant and tenant.inbound_email:
                    allowed.add(_email_domain(tenant.inbound_email))
                _cfg = get_settings()
                if _cfg.resend_from:
                    allowed.add(_email_domain(_cfg.resend_from))
                allowed = {d for d in allowed if d}
            for alias in aliases:
                if not _is_valid_email(alias):
                    raise HTTPException(status_code=400, detail=f"Invalid alias email address: {alias}")
                if allowed and _email_domain(alias) not in allowed:
                    raise HTTPException(status_code=403, detail="Alias domain is not permitted for this tenant")
        current_user.send_from_aliases = aliases
    if body.tour_completed is not None:
        current_user.tour_completed = body.tour_completed
    if body.setup_checklist_dismissed is True:
        current_user.setup_checklist_dismissed = True
    if body.ui_language is not None and body.ui_language in ("en", "nl"):
        current_user.ui_language = body.ui_language
    if "jarvis_prefs" in body.model_fields_set:
        current_user.jarvis_prefs = body.jarvis_prefs
    if body.help_tips_enabled is not None:
        current_user.help_tips_enabled = body.help_tips_enabled
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
            detail="Signature is too large. Embedded images must be 500 KB or smaller.",
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


@router.get("/manual.pdf", include_in_schema=False)
async def download_manual_pdf(current_user: CurrentUser):
    from app.core.manual_pdf import generate_manual_pdf
    # PDF generation is CPU-bound — keep it off the event loop.
    pdf_bytes = await asyncio.to_thread(generate_manual_pdf)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": 'attachment; filename="yippie-platform-manual.pdf"'},
    )
