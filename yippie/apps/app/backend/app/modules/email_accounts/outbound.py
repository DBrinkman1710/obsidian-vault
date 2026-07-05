"""Outbound dispatch through a linked Gmail/Outlook account (EML1).

Called from flush_pending_sends when the queued row snapshotted an
email_account_id. There is deliberately NO fallback to Resend here: sending
from a Gmail/Outlook address through Resend would fail SPF/DKIM and
misrepresent the sender — a failed provider send stays queued for retry.
"""
from __future__ import annotations

import json
import logging
import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.email_accounts import service as accounts_service
from app.modules.email_accounts.mime import build_mime
from app.modules.email_accounts.models import EmailAccount
from app.modules.email_accounts.providers import get_provider
from app.modules.inbox.models import DraftTicket, InboundMessage

log = logging.getLogger("yippie.email_accounts.outbound")


class LinkedAccountUnavailableError(Exception):
    """Account row missing or not active — retry later (lease machinery)."""


async def send_via_linked_account(
    db: AsyncSession,
    *,
    account_id: uuid.UUID,
    to_email: str,
    subject: str,
    text: str,
    html: str | None,
    attachments: list[dict] | None,  # Resend shape: {filename, content(b64), content_type}
    cc: list[str] | None = None,
    bcc: list[str] | None = None,
    draft_id: uuid.UUID | None = None,
    kind: str = "reply",
) -> tuple[str, str]:
    """Send raw MIME via the account's provider.

    Returns (provider_send_id_or_our_message_id, provider_name). Raises
    AccountRevokedError (account marked revoked, caller commits separately),
    LinkedAccountUnavailableError, or ProviderAPIError (both retryable).
    """
    account = await db.get(EmailAccount, account_id)
    if account is None or account.status != "active":
        raise LinkedAccountUnavailableError(
            f"Linked account {account_id} is "
            f"{'missing' if account is None else account.status}"
        )

    access = await accounts_service.get_valid_access_token(db, account)

    # Reply threading: pull Message-ID/References/thread id from the inbound
    # message this draft was created from (stored by the sync job).
    in_reply_to = references = thread_ref = None
    if kind == "reply" and draft_id:
        msg = (await db.execute(
            select(InboundMessage)
            .join(DraftTicket, DraftTicket.inbound_message_id == InboundMessage.id)
            .where(DraftTicket.id == draft_id)
        )).scalar_one_or_none()
        if msg is not None:
            in_reply_to = msg.smtp_message_id
            if msg.raw_headers:
                try:
                    hdrs = json.loads(msg.raw_headers)
                except (ValueError, TypeError):
                    hdrs = {}
                in_reply_to = in_reply_to or hdrs.get("message_id")
                references = hdrs.get("references")
                thread_ref = hdrs.get("thread_ref")

    mime_bytes, message_id = build_mime(
        from_email=account.email_address,
        from_name=account.display_name,
        to=[to_email],
        cc=cc,
        bcc=bcc,
        subject=subject,
        text=text,
        html=html,
        attachments=[
            {
                "filename": a.get("filename") or "attachment",
                "content_type": a.get("content_type") or "application/octet-stream",
                "content_b64": a.get("content") or "",
            }
            for a in attachments or []
            if a.get("content")
        ],
        in_reply_to=in_reply_to,
        references=references,
    )

    provider = get_provider(account.provider)
    sent_id = await provider.send_message(access, mime_bytes, thread_ref=thread_ref)
    # Graph's sendMail returns no id — fall back to our own RFC822 Message-ID
    return sent_id or message_id, account.provider
