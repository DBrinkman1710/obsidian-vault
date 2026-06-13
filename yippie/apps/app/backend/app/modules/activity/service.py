from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.activity.models import ActivityEvent


async def log_event(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    module: str,
    event_type: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    contact_id: Optional[uuid.UUID] = None,
    actor_id: Optional[uuid.UUID] = None,
    payload: Optional[dict] = None,
) -> ActivityEvent:
    event = ActivityEvent(
        tenant_id=tenant_id,
        contact_id=contact_id,
        actor_id=actor_id,
        module=module,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload,
    )
    db.add(event)
    await db.flush()
    return event


async def list_events(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_id: Optional[uuid.UUID] = None,
    limit: int = 100,
) -> list[dict]:
    from app.core.models import User

    q = (
        select(ActivityEvent, User.full_name.label("actor_name"))
        .outerjoin(User, ActivityEvent.actor_id == User.id)
        .where(ActivityEvent.tenant_id == tenant_id)
    )
    if contact_id:
        q = q.where(ActivityEvent.contact_id == contact_id)
    result = await db.execute(q.order_by(ActivityEvent.created_at.desc()).limit(limit))
    events = []
    for row in result.all():
        ev: ActivityEvent = row[0]
        events.append({
            "id": ev.id,
            "tenant_id": ev.tenant_id,
            "contact_id": ev.contact_id,
            "actor_id": ev.actor_id,
            "actor_name": row[1],
            "module": ev.module,
            "event_type": ev.event_type,
            "entity_type": ev.entity_type,
            "entity_id": ev.entity_id,
            "payload": ev.payload,
            "created_at": ev.created_at,
        })
    return events


async def get_activity_stats(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    base = ActivityEvent.tenant_id == tenant_id
    total = await db.scalar(select(func.count()).where(base))
    today = await db.scalar(select(func.count()).where(base, ActivityEvent.created_at >= today_start))
    this_week = await db.scalar(select(func.count()).where(base, ActivityEvent.created_at >= week_start))
    return {"today": today or 0, "this_week": this_week or 0, "total": total or 0}
