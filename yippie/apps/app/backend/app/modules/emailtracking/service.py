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
    actor_id: uuid.UUID | None = None,
    contact_id: uuid.UUID | None = None,
    draft_id: uuid.UUID | None = None,
    kind: str = "compose",
) -> OutboundEmail:
    record = OutboundEmail(
        tenant_id=tenant_id,
        resend_email_id=resend_email_id,
        to_email=to_email,
        subject=subject,
        actor_id=actor_id,
        contact_id=contact_id,
        draft_id=draft_id,
        kind=kind,
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
