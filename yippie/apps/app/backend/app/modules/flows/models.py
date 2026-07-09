from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class Flow(Base):
    """A tenant-configured automation rule: when <trigger>, if <conditions>, then <actions>.

    conditions: list of {"field", "op", "value"} evaluated with AND semantics.
    actions:    ordered list of {"id", "type", "config"} executed by the flow
                engine — or, since [FLOW4], a graph {"nodes", "edges"} with
                branch nodes (a linear list is one chain via graph.as_graph).
    Both are validated at the app layer (schemas.py) so new ops/actions never
    need a migration.
    """

    __tablename__ = "flows"
    __table_args__ = (
        Index("ix_flows_tenant_trigger", "tenant_id", "trigger_type"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # [FLOW9] Yippie-installed showcase flow: viewable on the canvas but not
    # editable (duplicate it to customise), deletable, and never counted against
    # the plan's active-flow cap.
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    trigger_type: Mapped[str] = mapped_column(String(50), nullable=False)
    conditions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    actions: Mapped[list | dict] = mapped_column(JSONB, nullable=False, default=list)
    # Phase 2: trigger-specific settings (e.g. schedule frequency/time). Defaults
    # to {} for the mutation-driven triggers. last_scheduled_on is the local date
    # string the schedule trigger last fired on (once-a-day dedup).
    trigger_config: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    last_scheduled_on: Mapped[str | None] = mapped_column(String(10), nullable=True)
    # [FLOW5] The per-flow secret in the public inbound webhook URL
    # (POST /flows/hook/{token}). Set only on webhook-trigger flows; a partial
    # unique index (see migration flows5_webhooks) enforces uniqueness while
    # allowing NULL on every other flow.
    webhook_token: Mapped[str | None] = mapped_column(String(64), nullable=True, unique=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    run_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    last_run_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class FlowRun(Base):
    """Audit log: one row per (event, matching flow) — including skipped matches
    so tenants can debug why a flow did or didn't fire."""

    __tablename__ = "flow_runs"
    __table_args__ = (
        Index("ix_flow_runs_tenant_flow_created", "tenant_id", "flow_id", "created_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    flow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("flows.id", ondelete="CASCADE"), nullable=False
    )
    event: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    status: Mapped[str] = mapped_column(String(20), nullable=False)  # success|partial|failed|skipped
    results: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FlowPendingStep(Base):
    """A paused flow run waiting to resume — either a delay ("wait") step or a
    failed action queued for retry. The engine persists the REMAINING actions +
    the frozen results-so-far here, then drains due rows on the same 10s tick.

    kind='wait'  — resume_at = now + the delay; attempt is 0.
    kind='retry' — resume_at = now + backoff; attempt = prior failures of the
                   step the run resumes at.

    `actions` holds the REMAINING work: a legacy list of remaining actions
    (pre-[FLOW4] rows), or since [FLOW4] {"graph": <full graph>, "next": <node
    id to resume at>} — the graph is snapshotted so an edit mid-wait never
    reroutes an in-flight run.

    Row is deleted (claim-first) when picked up, so a crash mid-resume loses at
    most one step — never double-runs the actions already frozen in `results`."""

    __tablename__ = "flow_pending_steps"
    __table_args__ = (
        Index("ix_flow_pending_steps_resume", "resume_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    flow_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("flows.id", ondelete="CASCADE"), nullable=False
    )
    run_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("flow_runs.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(10), nullable=False, default="wait")  # wait|retry
    event: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    actions: Mapped[list | dict] = mapped_column(JSONB, nullable=False, default=list)  # remaining
    results: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)  # completed so far
    attempt: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    resume_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class FlowEvent(Base):
    """Transactional outbox: written in the same transaction as the triggering
    mutation, drained by the flow engine scheduler (~10s). source='flow' rows
    are never evaluated — flow actions can't trigger further flows (phase 1
    loop protection)."""

    __tablename__ = "flow_events"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    event_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_type: Mapped[str] = mapped_column(String(50), nullable=False)
    entity_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    contact_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    payload: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    source: Mapped[str] = mapped_column(String(20), nullable=False, default="app")
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
