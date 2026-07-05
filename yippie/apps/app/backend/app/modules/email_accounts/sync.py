"""Inbound sync for linked Gmail/Outlook mailboxes (EML1).

Runs from the poll_oauth_inboxes scheduler job. Each account syncs in its own
DB session so one failing account never blocks the rest — mirroring the
per-email isolation of the Resend poller. Background jobs run on the
connecting role, so RLS does not apply here (same as flush_pending_sends).
"""
from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.core.models import Tenant
from app.database import db_session
from app.modules.email_accounts import service as accounts_service
from app.modules.email_accounts.mime import YIPPIE_SENT_HEADER
from app.modules.email_accounts.models import EmailAccount
from app.modules.email_accounts.providers import get_provider
from app.modules.email_accounts.providers.base import ProviderAPIError, ProviderMessage
from app.modules.email_accounts.service import AccountRevokedError
from app.modules.inbox import service as inbox_service
from app.modules.inbox.models import InboundMessage

log = logging.getLogger("yippie.email_accounts.sync")

# After this many consecutive failed sync runs the account is flagged 'error'
# (badge in settings). It keeps being retried — only 'revoked' is terminal.
MAX_CONSECUTIVE_FAILURES = 5


async def sync_all_accounts() -> None:
    async with db_session() as db:
        account_ids = list((await db.execute(
            select(EmailAccount.id).where(EmailAccount.status != "revoked")
        )).scalars().all())

    for account_id in account_ids:
        try:
            await _sync_account(account_id)
        except Exception:
            log.exception("sync failed for email account %s", account_id)


async def _sync_account(account_id: uuid.UUID) -> None:
    async with db_session() as db:
        account = await db.get(EmailAccount, account_id)
        if account is None or account.status == "revoked":
            return

        try:
            access = await accounts_service.get_valid_access_token(db, account)
        except AccountRevokedError:
            await db.commit()  # persist status='revoked' + last_error
            return

        provider = get_provider(account.provider)
        try:
            messages, new_state = await provider.list_new_messages(
                access, account.sync_state or {}
            )
        except ProviderAPIError as exc:
            await _record_failure(db, account, exc)
            return

        tenant = await db.get(Tenant, account.tenant_id)
        if tenant is None:
            return
        ai_scan = "ai" in (tenant.enabled_modules or []) and bool(tenant.ai_auto_scan)

        ingested = 0
        for msg in messages:
            if _should_skip(account, msg):
                continue
            if await _already_ingested(db, account.id, msg.provider_message_id):
                continue
            body = _body_text(msg)
            if not body and not (msg.subject or "").strip():
                continue
            try:
                await inbox_service.ingest_email(
                    db=db,
                    tenant_id=account.tenant_id,
                    sender=msg.sender,
                    sender_name=msg.sender_name,
                    subject=msg.subject,
                    body=body,
                    headers=_threading_headers_json(msg),
                    inbound_to=account.email_address,
                    attachments_json=_attachments_json(msg),
                    ai_scan=ai_scan,
                    email_account_id=account.id,
                    provider_message_id=msg.provider_message_id,
                    smtp_message_id=msg.smtp_message_id,
                )
                ingested += 1
            except IntegrityError:
                # Two containers share one DB (sandbox/devsandbox) — the unique
                # index on (email_account_id, provider_message_id) rejects the
                # loser; skip just this message (poller pattern).
                await db.rollback()
                log.info("Skipping %s — already ingested by the other container",
                         msg.provider_message_id)

        # Reassign (never mutate) so SQLAlchemy detects the JSONB change
        counters = {"consecutive_failures": 0}
        account.sync_state = {**(new_state or {}), **counters}
        account.last_synced_at = datetime.now(timezone.utc)
        if account.status == "error":
            account.status = "active"
            account.last_error = None
        await db.commit()
        if ingested:
            log.info("Synced %d message(s) from %s (%s)",
                     ingested, account.email_address, account.provider)


async def _record_failure(db, account: EmailAccount, exc: ProviderAPIError) -> None:
    state = dict(account.sync_state or {})
    failures = int(state.get("consecutive_failures", 0)) + 1
    state["consecutive_failures"] = failures
    account.sync_state = state
    if failures >= MAX_CONSECUTIVE_FAILURES:
        account.status = "error"
        account.last_error = str(exc)
    log.warning("Sync failure %d/%d for %s: %s",
                failures, MAX_CONSECUTIVE_FAILURES, account.email_address, exc)
    await db.commit()


def _should_skip(account: EmailAccount, msg: ProviderMessage) -> bool:
    """Loop prevention: never re-ingest the account's own or Yippie-sent mail."""
    if msg.sender == account.email_address.lower():
        return True
    lower_headers = {k.lower() for k in msg.raw_headers}
    if YIPPIE_SENT_HEADER.lower() in lower_headers:
        return True
    return False


async def _already_ingested(db, account_id: uuid.UUID, provider_message_id: str) -> bool:
    row = await db.execute(
        select(InboundMessage.id).where(
            InboundMessage.email_account_id == account_id,
            InboundMessage.provider_message_id == provider_message_id,
        ).limit(1)
    )
    return row.scalar_one_or_none() is not None


def _body_text(msg: ProviderMessage) -> str:
    if msg.body_text and msg.body_text.strip():
        return msg.body_text.strip()
    if msg.body_html:
        from app.modules.inbox.email_poller import _html_to_text  # lazy: avoids import cycle

        return _html_to_text(msg.body_html).strip()
    return ""


def _threading_headers_json(msg: ProviderMessage) -> str | None:
    """Store just what the reply path needs for In-Reply-To/References."""
    data = {
        "message_id": msg.smtp_message_id,
        "in_reply_to": msg.in_reply_to,
        "references": msg.references_header,
        "thread_ref": msg.thread_ref,
    }
    if not any(data.values()):
        return None
    return json.dumps(data)


def _attachments_json(msg: ProviderMessage) -> str | None:
    if not msg.attachments:
        return None
    return json.dumps([
        {
            "id": f"{msg.provider_message_id}-{i}",
            "filename": att.filename,
            "content_type": att.content_type,
            "content": att.content_b64,
        }
        for i, att in enumerate(msg.attachments)
    ])
