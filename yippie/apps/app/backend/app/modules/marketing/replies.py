"""MKTG1 — Inbound reply tracking for campaigns.

Called when an inbound email reply arrives (from the emailtracking webhook /
inbox ingestion). Matches the sender to the latest campaign_analytics row for
that email + tenant, classifies the reply via Claude Haiku, marks it 'replied',
and auto-unsubscribes the contact on an opt-out classification.
"""
from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.modules.marketing import service

log = logging.getLogger(__name__)

# Allowed classification labels returned by the model.
_LABELS = {"Interested", "Opt-out", "Out of office", "Other"}

_PROMPT = (
    "You classify a customer's reply to a marketing email into exactly one of "
    "these labels: Interested, Opt-out, Out of office, Other. "
    "Reply with ONLY the label, nothing else.\n\nReply text:\n"
)


async def classify_reply(body: str) -> str:
    """Classify a reply body via Claude Haiku. Falls back to 'Other'."""
    settings = get_settings()
    if not settings.anthropic_api_key or not (body or "").strip():
        return "Other"
    try:
        import anthropic

        client = anthropic.AsyncAnthropic(api_key=settings.anthropic_api_key)
        message = await client.messages.create(
            model=settings.ai_model,
            max_tokens=16,
            messages=[{"role": "user", "content": _PROMPT + body[:4000]}],
        )
        text = ""
        for block in getattr(message, "content", None) or []:
            t = getattr(block, "text", None)
            if t:
                text += t
        text = text.strip()
        for label in _LABELS:
            if label.lower() in text.lower():
                return label
    except Exception:
        log.exception("Reply classification failed")
    return "Other"


async def handle_inbound_reply(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    sender_email: str,
    body: str,
) -> bool:
    """Match the reply to a campaign recipient, classify it, mark replied, and
    auto-unsubscribe on opt-out. Returns True when a matching campaign row was
    found and updated."""
    classification = await classify_reply(body)
    row = await service.mark_replied(db, sender_email, tenant_id, classification)
    if row is None:
        return False

    if classification == "Opt-out":
        from app.modules.contacts.models import Contact

        result = await db.execute(
            select(Contact).where(
                Contact.tenant_id == tenant_id,
                Contact.email == sender_email,
                Contact.deleted_at.is_(None),
            )
        )
        contact = result.scalar_one_or_none()
        if contact is not None:
            await service.create_unsubscribe(db, contact.id, tenant_id)
    return True
