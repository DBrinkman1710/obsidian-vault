"""Flow trigger emission — the write side of the Flows module's outbox.

Services call ``emit_flow_event`` inside the same transaction as the mutation
that triggered it (flush, no commit — the caller commits), so an event exists
iff the mutation committed. The flow engine scheduler drains unprocessed rows.

Kept in ``core`` (like ``customer_context``) because module services import it;
importing it must never pull in the engine or its scheduler.
"""
from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession


def _jsonable(value):
    if isinstance(value, uuid.UUID):
        return str(value)
    return value


async def emit_flow_event(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    event_type: str,
    *,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    contact_id: Optional[uuid.UUID] = None,
    actor_id: Optional[uuid.UUID] = None,
    payload: Optional[dict] = None,
    source: str = "app",
) -> None:
    from app.modules.flows.models import FlowEvent

    event = FlowEvent(
        tenant_id=tenant_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        contact_id=contact_id,
        actor_id=actor_id,
        payload={k: _jsonable(v) for k, v in (payload or {}).items()},
        source=source,
    )
    db.add(event)
    await db.flush()
