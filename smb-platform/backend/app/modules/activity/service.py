from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import select
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
) -> list[ActivityEvent]:
    q = select(ActivityEvent).where(ActivityEvent.tenant_id == tenant_id)
    if contact_id:
        q = q.where(ActivityEvent.contact_id == contact_id)
    result = await db.execute(q.order_by(ActivityEvent.created_at.desc()).limit(limit))
    return result.scalars().all()
