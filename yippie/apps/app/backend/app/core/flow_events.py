"""Flow trigger emission — the write side of the Flows module's outbox.

Services call ``emit_flow_event`` inside the same transaction as the mutation
that triggered it (flush, no commit — the caller commits), so an event exists
iff the mutation committed. The flow engine scheduler drains unprocessed rows.

[FLOW6] chain identity: when the engine runs a flow action it wraps the
executor in ``chain_scope`` — every event emitted underneath (whatever service
signature sits in between) gets ``chain_depth``/``chain_path`` stamped into its
payload, so chained evaluation can enforce the depth cap and cycle guard. A
ContextVar rather than a parameter because the identity would otherwise have to
thread through every module service between an executor and its emit call; it
propagates through awaits within the engine's task and never leaks across
requests.

Kept in ``core`` (like ``customer_context``) because module services import it;
importing it must never pull in the engine or its scheduler.
"""
from __future__ import annotations

import uuid
from contextlib import contextmanager
from contextvars import ContextVar
from typing import Iterator, Optional

from sqlalchemy.ext.asyncio import AsyncSession

_chain_context: ContextVar[Optional[dict]] = ContextVar("flow_chain_context", default=None)


@contextmanager
def chain_scope(chain: dict) -> Iterator[None]:
    """[FLOW6] Stamp ``{"depth", "path"}`` onto every flow event emitted inside
    this scope. Set by the engine around each action executor call."""
    token = _chain_context.set(chain)
    try:
        yield
    finally:
        _chain_context.reset(token)


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

    payload = {k: _jsonable(v) for k, v in (payload or {}).items()}
    # [FLOW6] inside a chain_scope (i.e. this mutation was caused by a flow
    # action) the event carries its chain identity for the engine's gates.
    chain = _chain_context.get()
    if chain is not None:
        payload["chain_depth"] = chain["depth"]
        payload["chain_path"] = chain["path"]

    event = FlowEvent(
        tenant_id=tenant_id,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        contact_id=contact_id,
        actor_id=actor_id,
        payload=payload,
        source=source,
    )
    db.add(event)
    await db.flush()
