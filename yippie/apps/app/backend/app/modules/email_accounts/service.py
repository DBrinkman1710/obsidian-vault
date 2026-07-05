from __future__ import annotations

import logging
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_secret, encrypt_secret
from app.modules.email_accounts.models import EmailAccount
from app.modules.email_accounts.providers import get_provider
from app.modules.email_accounts.providers.base import ProviderAuthError, TokenBundle

log = logging.getLogger("yippie.email_accounts")

# Refresh the access token this long before its recorded expiry
_EXPIRY_BUFFER = timedelta(seconds=120)


class AccountRevokedError(Exception):
    """The provider rejected our refresh token — the user must reconnect."""


async def upsert_account(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID | None,
    provider: str,
    bundle: TokenBundle,
) -> EmailAccount:
    """Create the linked account, or refresh tokens on an existing row (re-link)."""
    existing = (await db.execute(
        select(EmailAccount).where(
            EmailAccount.tenant_id == tenant_id,
            EmailAccount.email_address == bundle.email,
        )
    )).scalar_one_or_none()

    expires_at = datetime.now(timezone.utc) + timedelta(seconds=bundle.expires_in)
    if existing:
        existing.provider = provider
        existing.user_id = user_id
        existing.refresh_token_encrypted = encrypt_secret(bundle.refresh_token)
        existing.access_token_encrypted = encrypt_secret(bundle.access_token)
        existing.access_token_expires_at = expires_at
        existing.scopes = bundle.scopes
        existing.display_name = bundle.display_name or existing.display_name
        existing.status = "active"
        existing.last_error = None
        return existing

    account = EmailAccount(
        tenant_id=tenant_id,
        user_id=user_id,
        provider=provider,
        email_address=bundle.email,
        display_name=bundle.display_name,
        refresh_token_encrypted=encrypt_secret(bundle.refresh_token),
        access_token_encrypted=encrypt_secret(bundle.access_token),
        access_token_expires_at=expires_at,
        scopes=bundle.scopes,
        status="active",
    )
    db.add(account)
    return account


async def get_valid_access_token(db: AsyncSession, account: EmailAccount) -> str:
    """Cached access token, refreshed when within the expiry buffer.

    On invalid_grant the account is marked revoked (caller must commit) and
    AccountRevokedError is raised.
    """
    now = datetime.now(timezone.utc)
    if (
        account.access_token_encrypted
        and account.access_token_expires_at
        and account.access_token_expires_at > now + _EXPIRY_BUFFER
    ):
        return decrypt_secret(account.access_token_encrypted)

    provider = get_provider(account.provider)
    try:
        access, expires_in, rotated_refresh = await provider.refresh_access_token(
            decrypt_secret(account.refresh_token_encrypted)
        )
    except ProviderAuthError as exc:
        account.status = "revoked"
        account.last_error = str(exc)
        log.warning("Email account %s (%s) revoked: %s", account.id, account.email_address, exc)
        raise AccountRevokedError(str(exc)) from exc

    account.access_token_encrypted = encrypt_secret(access)
    account.access_token_expires_at = now + timedelta(seconds=expires_in)
    if rotated_refresh:  # Graph rotates refresh tokens on every refresh
        account.refresh_token_encrypted = encrypt_secret(rotated_refresh)
    return access


async def get_linked_addresses(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID | None
) -> list[str]:
    """Linked mailbox addresses for inbox routing. user_id None → tenant-level
    (shared) accounts; set → that user's personal accounts. All statuses are
    included so mail from a since-revoked account stays visible."""
    rows = (await db.execute(
        select(EmailAccount.email_address).where(
            EmailAccount.tenant_id == tenant_id,
            EmailAccount.user_id.is_(None) if user_id is None else EmailAccount.user_id == user_id,
        )
    )).scalars().all()
    return list(rows)


async def list_visible_accounts(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID
) -> list[EmailAccount]:
    """Tenant-level accounts + the caller's own personal accounts."""
    rows = (await db.execute(
        select(EmailAccount)
        .where(EmailAccount.tenant_id == tenant_id)
        .where((EmailAccount.user_id.is_(None)) | (EmailAccount.user_id == user_id))
        .order_by(EmailAccount.created_at)
    )).scalars().all()
    return list(rows)
