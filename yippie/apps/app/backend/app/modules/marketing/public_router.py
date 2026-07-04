"""MKTG1 — Public, unauthenticated marketing endpoints.

- GET /track/open/{token}        → record an open, return a 1x1 GIF
- GET /track/unsubscribe/{token} → record an opt-out, return an HTML page

Mounted in main.py WITHOUT auth dependencies (alongside the tracking_router).
Tenant context is set from the analytics row's own tenant_id so RLS passes.
"""
from __future__ import annotations

import html
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.responses import HTMLResponse, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db, set_tenant_context
from app.modules.marketing import service
from app.modules.marketing.models import Campaign, CampaignAnalytics

router = APIRouter(prefix="/track", tags=["marketing-tracking"])

DB = Annotated[AsyncSession, Depends(get_db)]

# 1x1 transparent GIF.
_PIXEL = (
    b"\x47\x49\x46\x38\x39\x61\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff"
    b"\x00\x00\x00\x21\xf9\x04\x00\x00\x00\x00\x00\x2c\x00\x00\x00\x00"
    b"\x01\x00\x01\x00\x00\x02\x02\x44\x01\x00\x3b"
)


@router.get("/open/{token}", include_in_schema=False)
async def track_open(token: uuid.UUID, db: DB):
    """Record an open event and return a 1x1 transparent GIF.

    Always returns the pixel — even on unknown/expired tokens — so an email
    client never shows a broken image.
    """
    result = await db.execute(
        select(CampaignAnalytics).where(CampaignAnalytics.tracking_token == token)
    )
    row = result.scalar_one_or_none()
    if row is not None:
        await set_tenant_context(db, str(row.tenant_id))
        try:
            await service.mark_opened(db, token)
            await db.commit()
        except Exception:
            await db.rollback()
    return Response(content=_PIXEL, media_type="image/gif")


def _unsub_page(message: str) -> str:
    # message may embed tenant-controlled text (campaign name) — escape it so a
    # crafted campaign name can't inject HTML/script into this page.
    message = html.escape(message)
    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        "<meta name='viewport' content='width=device-width, initial-scale=1'>"
        "<title>Unsubscribe</title></head>"
        "<body style=\"margin:0;font-family:-apple-system,BlinkMacSystemFont,"
        "'Segoe UI',Roboto,Helvetica,Arial,sans-serif;background:#f3f4f6;\">"
        "<div style='max-width:480px;margin:80px auto;background:#fff;border-radius:12px;"
        "border:1px solid #e5e7eb;padding:40px 32px;text-align:center;'>"
        "<div style='height:4px;background:#5BB8E8;border-radius:2px;margin:-40px -32px 28px;'></div>"
        f"<h2 style='color:#1f2937;margin:0 0 10px;font-size:20px;'>You're unsubscribed</h2>"
        f"<p style='color:#6b7280;font-size:15px;line-height:1.5;margin:0;'>{message}</p>"
        "</div></body></html>"
    )


@router.get("/unsubscribe/{token}", response_class=HTMLResponse, include_in_schema=False)
async def track_unsubscribe(token: uuid.UUID, db: DB):
    """Opt the recipient out and show a confirmation page."""
    result = await db.execute(
        select(CampaignAnalytics).where(CampaignAnalytics.tracking_token == token)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return HTMLResponse(
            _unsub_page("This unsubscribe link is invalid or has expired."),
            status_code=200,
        )

    await set_tenant_context(db, str(row.tenant_id))

    # Resolve the contact by email within the tenant to record the opt-out.
    from app.modules.contacts.models import Contact

    campaign = await db.get(Campaign, row.campaign_id)
    campaign_name = campaign.name if campaign else "this campaign"

    contact_result = await db.execute(
        select(Contact).where(
            Contact.tenant_id == row.tenant_id,
            Contact.email == row.recipient_email,
            Contact.deleted_at.is_(None),
        )
    )
    contact = contact_result.scalar_one_or_none()
    try:
        if contact is not None:
            await service.create_unsubscribe(db, contact.id, row.tenant_id)
        await db.commit()
    except Exception:
        await db.rollback()

    return HTMLResponse(
        _unsub_page(
            f"You've been unsubscribed from {campaign_name}. "
            "You won't receive further emails."
        ),
        status_code=200,
    )
