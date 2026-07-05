from __future__ import annotations
import uuid
from datetime import datetime, timezone
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.modules.emailtracking.models import OutboundEmail

async def create_outbound_email(
    db: AsyncSession,
    *,
    tenant_id: uuid.UUID,
    resend_email_id: str | None,
    to_email: str,
    subject: str,
    body: str | None = None,
    actor_id: uuid.UUID | None = None,
    contact_id: uuid.UUID | None = None,
    draft_id: uuid.UUID | None = None,
    kind: str = "compose",
    provider: str = "resend",
) -> OutboundEmail:
    record = OutboundEmail(
        tenant_id=tenant_id,
        resend_email_id=resend_email_id,
        to_email=to_email,
        subject=subject,
        body=body,
        actor_id=actor_id,
        contact_id=contact_id,
        draft_id=draft_id,
        kind=kind,
        provider=provider,
        status="sent",
    )
    db.add(record)
    await db.flush()
    return record

async def get_by_resend_id(db: AsyncSession, resend_email_id: str) -> OutboundEmail | None:
    result = await db.execute(
        select(OutboundEmail).where(OutboundEmail.resend_email_id == resend_email_id)
    )
    return result.scalar_one_or_none()

async def handle_event(db: AsyncSession, resend_email_id: str, event_type: str, event_time: datetime | None = None) -> bool:
    """Update OutboundEmail status from a Resend webhook event. Returns True if found."""
    record = await get_by_resend_id(db, resend_email_id)
    if not record:
        return False
    now = event_time or datetime.now(timezone.utc)
    if event_type == "email.delivered" and not record.delivered_at:
        record.delivered_at = now
        if record.status == "sent":
            record.status = "delivered"
    elif event_type == "email.opened" and not record.opened_at:
        record.opened_at = now
        if record.status in ("sent", "delivered"):
            record.status = "opened"
    elif event_type == "email.clicked":
        record.clicked_count += 1
        if not record.clicked_at:
            record.clicked_at = now
        if record.status in ("sent", "delivered", "opened"):
            record.status = "clicked"
    elif event_type == "email.bounced" and not record.bounced_at:
        record.bounced_at = now
        record.status = "bounced"
    await db.flush()
    return True

_RESEND_LAST_EVENT_MAP = {
    "delivered": "email.delivered",
    "opened": "email.opened",
    "clicked": "email.clicked",
    "bounced": "email.bounced",
}

async def list_pending_sync(db: AsyncSession, max_age_days: int = 7) -> list[OutboundEmail]:
    """Return 'sent' emails with a Resend ID that haven't been delivered yet."""
    from datetime import timedelta
    from sqlalchemy import and_
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    result = await db.execute(
        select(OutboundEmail)
        .where(
            and_(
                OutboundEmail.status == "sent",
                OutboundEmail.resend_email_id.is_not(None),
                # Gmail/Outlook sends (EML1) store provider message ids — those
                # are not Resend ids, so never poll Resend for them.
                OutboundEmail.provider == "resend",
                OutboundEmail.created_at > cutoff,
            )
        )
        .limit(50)
    )
    return list(result.scalars().all())

async def sync_status_from_resend(db: AsyncSession, api_key: str) -> int:
    """Poll Resend API for each undelivered email and update status. Returns count updated."""
    import httpx
    pending = await list_pending_sync(db)
    if not pending:
        return 0
    updated = 0
    now = datetime.now(timezone.utc)
    async with httpx.AsyncClient(timeout=10) as client:
        for record in pending:
            try:
                resp = await client.get(
                    f"https://api.resend.com/emails/{record.resend_email_id}",
                    headers={"Authorization": f"Bearer {api_key}"},
                )
                if resp.status_code != 200:
                    continue
                last_event = resp.json().get("last_event", "")
                event_type = _RESEND_LAST_EVENT_MAP.get(last_event)
                if not event_type:
                    continue
                if event_type == "email.delivered" and not record.delivered_at:
                    record.delivered_at = now
                    record.status = "delivered"
                    updated += 1
                elif event_type == "email.opened" and not record.opened_at:
                    record.opened_at = now
                    if not record.delivered_at:
                        record.delivered_at = now
                    record.status = "opened"
                    updated += 1
                elif event_type == "email.clicked" and not record.clicked_at:
                    record.clicked_at = now
                    record.clicked_count += 1
                    if not record.delivered_at:
                        record.delivered_at = now
                    record.status = "clicked"
                    updated += 1
                elif event_type == "email.bounced" and not record.bounced_at:
                    record.bounced_at = now
                    record.status = "bounced"
                    updated += 1
            except Exception:
                pass
    return updated

async def list_outbound(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    limit: int = 200,
    search: str | None = None,
) -> list[OutboundEmail]:
    from sqlalchemy import or_

    q = select(OutboundEmail).where(OutboundEmail.tenant_id == tenant_id)
    if search and search.strip():
        # Case-insensitive search across subject and recipient email (pg_trgm friendly).
        term = f"%{search.strip()}%"
        q = q.where(or_(OutboundEmail.subject.ilike(term), OutboundEmail.to_email.ilike(term)))
    result = await db.execute(q.order_by(OutboundEmail.created_at.desc()).limit(limit))
    return list(result.scalars().all())
