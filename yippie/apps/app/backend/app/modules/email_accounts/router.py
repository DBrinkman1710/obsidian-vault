from __future__ import annotations

import logging
import uuid
from datetime import timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, require_module
from app.auth.tokens import create_signed_token, verify_signed_token
from app.config import get_settings
from app.core.models import UserRole
from app.database import get_db
from app.modules.email_accounts import service
from app.modules.email_accounts.models import EmailAccount
from app.modules.email_accounts.providers import PROVIDERS, get_provider
from app.modules.email_accounts.providers.base import ProviderAPIError, ProviderAuthError
from app.modules.email_accounts.schemas import (
    ConnectOut,
    ConnectRequest,
    EmailAccountOut,
    ProvidersOut,
)

log = logging.getLogger("yippie.email_accounts")

# Authenticated routes — inbox module gates the whole feature (it is an inbox
# transport, not a separate sellable module).
router = APIRouter(
    prefix="/email-accounts",
    tags=["email-accounts"],
    dependencies=[Depends(require_module("inbox"))],
)
# The OAuth callback is a bare browser redirect from Google/Microsoft — no
# cookie/JWT guaranteed. Identity comes from the signed `state` token instead.
callback_router = APIRouter(prefix="/email-accounts", tags=["email-accounts"])

DB = Annotated[AsyncSession, Depends(get_db)]

_STATE_PURPOSE = "email_oauth"
_STATE_TTL = timedelta(minutes=10)


def _redirect_base() -> str:
    # Deployed: SPA and API share the domain via nginx. Local dev: SPA on 5173.
    return get_settings().effective_base_url or "http://localhost:5173"


def _callback_base() -> str:
    # Local dev: the API listens on 8000 (no nginx in front).
    return get_settings().effective_base_url or "http://localhost:8000"


def _settings_path(level: str) -> str:
    return "/settings/team" if level == "tenant" else "/settings/profile"


def _encryption_ready() -> bool:
    return bool(get_settings().email_token_encryption_key)


@router.get("/providers", response_model=ProvidersOut)
async def get_providers(current_user: CurrentUser):
    ready = _encryption_ready()
    return ProvidersOut(
        gmail=ready and PROVIDERS["gmail"].is_configured(),
        outlook=ready and PROVIDERS["outlook"].is_configured(),
    )


@router.post("/connect", response_model=ConnectOut)
async def connect(body: ConnectRequest, current_user: CurrentUser):
    if body.level == "tenant" and current_user.role not in (UserRole.admin, UserRole.superadmin):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Only admins can link a shared mailbox")
    if not _encryption_ready():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Email account linking is not configured (encryption key missing)")
    provider = get_provider(body.provider)
    if not provider.is_configured():
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail=f"{body.provider} linking is not configured")

    state = create_signed_token(
        _STATE_PURPOSE,
        _STATE_TTL,
        tenant_id=str(current_user.tenant_id),
        user_id=str(current_user.id),
        level=body.level,
        provider=body.provider,
    )
    redirect_uri = f"{_callback_base()}/api/v1/email-accounts/callback/{body.provider}"
    return ConnectOut(authorize_url=provider.get_authorize_url(redirect_uri, state))


@callback_router.get("/callback/{provider_name}")
async def oauth_callback(
    provider_name: str,
    db: DB,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
):
    def _fail(reason: str, level: str = "user") -> RedirectResponse:
        return RedirectResponse(
            f"{_redirect_base()}{_settings_path(level)}?email_link=error&reason={reason}"
        )

    claims = verify_signed_token(state or "", _STATE_PURPOSE)
    if not claims or claims.get("provider") != provider_name:
        return _fail("invalid_state")
    level = claims.get("level", "user")
    if error or not code:
        # User cancelled the consent screen, or the provider returned an error
        return _fail("denied", level)

    try:
        provider = get_provider(provider_name)
    except ValueError:
        return _fail("invalid_state", level)

    redirect_uri = f"{_callback_base()}/api/v1/email-accounts/callback/{provider_name}"
    try:
        bundle = await provider.exchange_code(code, redirect_uri)
    except ProviderAuthError as exc:
        log.warning("OAuth exchange failed (%s): %s", provider_name, exc)
        return _fail("scopes" if "scope" in str(exc).lower() else "exchange", level)
    except ProviderAPIError as exc:
        log.warning("OAuth exchange provider error (%s): %s", provider_name, exc)
        return _fail("exchange", level)

    tenant_id = uuid.UUID(claims["tenant_id"])
    user_id = None if level == "tenant" else uuid.UUID(claims["user_id"])
    account = await service.upsert_account(
        db, tenant_id=tenant_id, user_id=user_id, provider=provider_name, bundle=bundle
    )

    # Baseline the sync cursor at link time — old mail is never backfilled
    try:
        from app.core.crypto import decrypt_secret
        account.sync_state = await provider.init_sync_state(
            decrypt_secret(account.access_token_encrypted)
        )
    except ProviderAPIError as exc:
        # Not fatal for linking; the sync job re-baselines on first run
        log.warning("init_sync_state failed for %s: %s", bundle.email, exc)

    await db.commit()
    return RedirectResponse(f"{_redirect_base()}{_settings_path(level)}?email_link=success")


@router.get("", response_model=list[EmailAccountOut])
async def list_accounts(current_user: CurrentUser, db: DB):
    return await service.list_visible_accounts(db, current_user.tenant_id, current_user.id)


@router.delete("/{account_id}", status_code=status.HTTP_204_NO_CONTENT)
async def disconnect(account_id: uuid.UUID, current_user: CurrentUser, db: DB):
    account = await db.get(EmailAccount, account_id)
    if not account or account.tenant_id != current_user.tenant_id:
        raise HTTPException(status_code=404, detail="Account not found")
    is_admin = current_user.role in (UserRole.admin, UserRole.superadmin)
    if account.user_id is None and not is_admin:
        raise HTTPException(status_code=403, detail="Only admins can disconnect a shared mailbox")
    if account.user_id is not None and account.user_id != current_user.id and not is_admin:
        raise HTTPException(status_code=403, detail="You can only disconnect your own account")

    try:
        from app.core.crypto import decrypt_secret
        await get_provider(account.provider).revoke(decrypt_secret(account.refresh_token_encrypted))
    except Exception as exc:  # best-effort — deleting our tokens is the real disconnect
        log.warning("Provider revoke failed for %s: %s", account.email_address, exc)

    await db.delete(account)
    await db.commit()
