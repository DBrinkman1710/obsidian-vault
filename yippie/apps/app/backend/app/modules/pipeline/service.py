from __future__ import annotations

import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.flow_events import emit_flow_event
from app.modules.activity import service as activity_service
from app.modules.contacts.models import Company, Contact
from app.modules.pipeline.flowchart_context import flowchart_to_text
from app.modules.pipeline.models import ContactPipelineEntry, PipelineFlowchart, PipelineStage
from app.modules.pipeline.schemas import (
    FlowchartGraph,
    FlowchartOut,
    FlowchartSuggestion,
    PipelineBoardColumn,
    PipelineBoardContact,
    PipelineStageCreate,
    PipelineStageOut,
    PipelineStageUpdate,
)


DEFAULT_STAGES = [
    {"name": "New",                  "color": "#94a3b8"},
    {"name": "In Progress",          "color": "#5BA4F5"},
    {"name": "Waiting for Customer", "color": "#f59e0b"},
    {"name": "Resolved",             "color": "#22c55e"},
]

# Kanban cards in a stage whose name contains "demo" (case-insensitive) for this
# many days get a follow-up alert in the UI.
DEMO_STAGE_SLA_DAYS = 3


async def find_stage_by_name(db: AsyncSession, tenant_id: uuid.UUID, name: str) -> Optional[PipelineStage]:
    """Return the first stage whose name matches (case-insensitive), or None."""
    return await db.scalar(
        select(PipelineStage).where(
            PipelineStage.tenant_id == tenant_id,
            func.lower(PipelineStage.name) == name.lower(),
        )
    )


async def provision_default_stages(db: AsyncSession, tenant_id: uuid.UUID) -> None:
    """Seed sensible default Kanban stages for a brand-new tenant.

    Called once at tenant creation. Safe to call on an existing tenant — it
    skips seeding when any stage already exists, so it never duplicates rows.
    """
    existing_count = await db.scalar(
        select(func.count()).select_from(PipelineStage).where(PipelineStage.tenant_id == tenant_id)
    )
    if existing_count:
        return  # already has stages — nothing to do

    for i, s in enumerate(DEFAULT_STAGES):
        db.add(PipelineStage(tenant_id=tenant_id, name=s["name"], color=s["color"], display_order=i))
    await db.commit()


async def list_stages(db: AsyncSession, tenant_id: uuid.UUID) -> list[PipelineStageOut]:
    count_q = (
        select(ContactPipelineEntry.stage_id, func.count().label("cnt"))
        .where(ContactPipelineEntry.tenant_id == tenant_id)
        .group_by(ContactPipelineEntry.stage_id)
        .subquery()
    )
    result = await db.execute(
        select(PipelineStage, func.coalesce(count_q.c.cnt, 0).label("cnt"))
        .outerjoin(count_q, PipelineStage.id == count_q.c.stage_id)
        .where(PipelineStage.tenant_id == tenant_id)
        .order_by(PipelineStage.display_order)
    )
    out = []
    for stage, cnt in result.all():
        o = PipelineStageOut.model_validate(stage)
        o.contact_count = int(cnt)
        out.append(o)
    return out


async def get_stage(db: AsyncSession, tenant_id: uuid.UUID, stage_id: uuid.UUID) -> Optional[PipelineStage]:
    result = await db.execute(
        select(PipelineStage).where(PipelineStage.tenant_id == tenant_id, PipelineStage.id == stage_id)
    )
    return result.scalar_one_or_none()


async def create_stage(
    db: AsyncSession, tenant_id: uuid.UUID, data: PipelineStageCreate
) -> PipelineStageOut:
    max_order = await db.scalar(
        select(func.max(PipelineStage.display_order)).where(PipelineStage.tenant_id == tenant_id)
    )
    stage = PipelineStage(
        tenant_id=tenant_id,
        name=data.name,
        color=data.color,
        display_order=(max_order or 0) + 1,
    )
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    out = PipelineStageOut.model_validate(stage)
    out.contact_count = 0
    return out


async def update_stage(
    db: AsyncSession, stage: PipelineStage, data: PipelineStageUpdate
) -> PipelineStageOut:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(stage, field, value)
    await db.commit()
    await db.refresh(stage)
    return PipelineStageOut.model_validate(stage)


async def delete_stage(db: AsyncSession, stage: PipelineStage) -> None:
    await db.delete(stage)
    await db.commit()


async def reorder_stages(db: AsyncSession, tenant_id: uuid.UUID, ids: list[uuid.UUID]) -> None:
    for i, stage_id in enumerate(ids):
        await db.execute(
            update(PipelineStage)
            .where(PipelineStage.id == stage_id, PipelineStage.tenant_id == tenant_id)
            .values(display_order=i)
        )
    await db.commit()


async def get_board(db: AsyncSession, tenant_id: uuid.UUID) -> list[PipelineBoardColumn]:
    stages = await list_stages(db, tenant_id)
    if not stages:
        return []

    result = await db.execute(
        select(
            ContactPipelineEntry.stage_id,
            Contact.id,
            Contact.full_name,
            Contact.email,
            Contact.company,
            ContactPipelineEntry.entered_at,
            Company.name.label("company_name"),
        )
        .join(Contact, Contact.id == ContactPipelineEntry.contact_id)
        .outerjoin(Company, Company.id == Contact.company_id)
        .where(ContactPipelineEntry.tenant_id == tenant_id)
        .order_by(ContactPipelineEntry.entered_at)
    )
    contacts_by_stage: dict[uuid.UUID, list[PipelineBoardContact]] = {}
    now = datetime.now(timezone.utc)
    for row in result.all():
        entered = row.entered_at
        if entered.tzinfo is None:
            entered = entered.replace(tzinfo=timezone.utc)
        days_in = max(0, int((now - entered).total_seconds() // 86_400))
        contacts_by_stage.setdefault(row.stage_id, []).append(
            PipelineBoardContact(
                contact_id=row.id,
                full_name=row.full_name,
                email=row.email,
                company_name=row.company_name or row.company,
                entered_at=row.entered_at,
                days_in_stage=days_in,
            )
        )

    stage_names = {s.id: s.name for s in stages}
    for stage_id, contacts in contacts_by_stage.items():
        stage_name = (stage_names.get(stage_id) or "").lower()
        is_demo_stage = "demo" in stage_name
        for contact in contacts:
            contact.stale_alert = is_demo_stage and contact.days_in_stage >= DEMO_STAGE_SLA_DAYS

    return [
        PipelineBoardColumn(stage=s, contacts=contacts_by_stage.get(s.id, []))
        for s in stages
    ]


class StageMoveSkipped(ValueError):
    """A non-human automation (flow, booking, tracking) tried to move a contact
    a human had manually placed. The move is skipped, not applied — restoring the
    original behaviour of respecting a human's pipeline placement."""


async def _assign_stage(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_id: uuid.UUID,
    stage_id: uuid.UUID,
    actor_id: Optional[uuid.UUID] = None,
    source: str = "app",
) -> str:
    """Write the stage assignment without committing. Caller must commit.
    Returns ``"applied"`` when a move landed, ``"noop"`` when nothing needed to
    change, or ``"blocked"`` when the human-placement guard refused it.

    Logs a ``pipeline_stage_changed`` activity event whenever the contact
    actually lands in a new stage. Every path that moves a contact between
    stages flows through here (kanban drag, booking auto-move, tracking link
    clicks), so the activity feed shows the full transition history inline.

    Automation (a flow action, a booking auto-move, a tracking link) never
    overrides a human's manual placement: if the contact's current entry was
    ``moved_by_human`` and this move isn't itself a human action, the move is
    refused (returns ``"blocked"``) so the operator's decision stands. Callers
    that need to surface the skip (the flow action) go through
    ``move_contact_to_stage``, which turns ``"blocked"`` into ``StageMoveSkipped``.
    """
    by_human = actor_id is not None
    existing = await db.scalar(
        select(ContactPipelineEntry).where(
            ContactPipelineEntry.contact_id == contact_id,
            ContactPipelineEntry.tenant_id == tenant_id,
        )
    )
    # Restore the human-placement guard: an automated move (no actor) that would
    # relocate a contact a human parked in a stage is refused entirely.
    if (
        not by_human
        and existing is not None
        and existing.moved_by_human
        and existing.stage_id != stage_id
    ):
        return "blocked"
    from_stage_id = existing.stage_id if existing else None
    changed = False
    if existing is None:
        db.add(ContactPipelineEntry(
            contact_id=contact_id, stage_id=stage_id, tenant_id=tenant_id,
            moved_by_human=by_human,
        ))
        changed = True
    elif existing.stage_id != stage_id:
        existing.stage_id = stage_id
        existing.entered_at = datetime.now(timezone.utc)
        existing.moved_by_human = by_human
        changed = True
    elif by_human and not existing.moved_by_human:
        # Same stage but human is explicitly confirming it — promote the flag.
        existing.moved_by_human = True

    if not changed:
        return "noop"

    stage_name = await db.scalar(
        select(PipelineStage.name).where(
            PipelineStage.id == stage_id,
            PipelineStage.tenant_id == tenant_id,
        )
    )
    await activity_service.log_event(
        db,
        tenant_id,
        module="pipeline",
        event_type="pipeline_stage_changed",
        entity_type="pipeline_stage",
        entity_id=stage_id,
        contact_id=contact_id,
        actor_id=actor_id,
        payload={"stage_name": stage_name, "body": f"Moved to {stage_name}"},
    )
    await emit_flow_event(
        db, tenant_id, "pipeline_stage_changed",
        entity_type="pipeline_stage", entity_id=stage_id,
        contact_id=contact_id, actor_id=actor_id,
        payload={
            "stage_id": stage_id,
            "stage_name": stage_name,
            "from_stage_id": from_stage_id,
            "contact_id": contact_id,
        },
        source=source,
    )
    return "applied"


async def move_contact_to_stage(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_id: uuid.UUID,
    stage_id: uuid.UUID,
    actor_id: Optional[uuid.UUID] = None,
    source: str = "app",
) -> None:
    exists = await db.scalar(
        select(Contact.id).where(Contact.tenant_id == tenant_id, Contact.id == contact_id)
    )
    if exists is None:
        raise ValueError("Contact not found")

    stage = await db.scalar(
        select(PipelineStage).where(PipelineStage.tenant_id == tenant_id, PipelineStage.id == stage_id)
    )
    if stage is None:
        raise ValueError("Stage not found")

    # _assign_stage logs the pipeline_stage_changed activity event itself
    # (only when the stage actually changes), so we don't log again here. An
    # automated move the guard blocked (human placement) surfaces as a skip so
    # the flow action records it rather than reporting a no-op success. A plain
    # "noop" (already in that stage) is left as a silent, successful move.
    outcome = await _assign_stage(db, tenant_id, contact_id, stage_id, actor_id=actor_id, source=source)
    if outcome == "blocked":
        raise StageMoveSkipped(
            "Contact was placed in its stage by a person — automation left it there"
        )
    await db.commit()


async def bulk_move_contacts_to_stage(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_ids: list[uuid.UUID],
    stage_id: uuid.UUID,
    actor_id: Optional[uuid.UUID] = None,
) -> None:
    stage = await db.scalar(
        select(PipelineStage).where(PipelineStage.tenant_id == tenant_id, PipelineStage.id == stage_id)
    )
    if stage is None:
        raise ValueError("Stage not found")

    for contact_id in contact_ids:
        exists = await db.scalar(
            select(Contact.id).where(Contact.tenant_id == tenant_id, Contact.id == contact_id)
        )
        if exists is None:
            continue
        await _assign_stage(db, tenant_id, contact_id, stage_id, actor_id=actor_id)

    await db.commit()


async def remove_contact_from_pipeline(
    db: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID
) -> None:
    await db.execute(
        delete(ContactPipelineEntry).where(
            ContactPipelineEntry.contact_id == contact_id,
            ContactPipelineEntry.tenant_id == tenant_id,
        )
    )
    await db.commit()


async def get_contact_stage(
    db: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID
) -> Optional[PipelineStageOut]:
    entry = await db.scalar(
        select(ContactPipelineEntry).where(
            ContactPipelineEntry.contact_id == contact_id,
            ContactPipelineEntry.tenant_id == tenant_id,
        )
    )
    if not entry:
        return None
    stage = await db.get(PipelineStage, entry.stage_id)
    if not stage:
        return None
    return PipelineStageOut.model_validate(stage)


# ──────────────────────────────────────────────────────────────
# [KAN_FLOW1] Pipeline flowchart
# ──────────────────────────────────────────────────────────────

def reconcile_flowchart(graph: FlowchartGraph, stages: list[PipelineStageOut]) -> FlowchartOut:
    """Reconcile a stored chart against the live board (source of truth).

    Pure — no DB. Two-way sync rule:
      * drop stage nodes whose stage no longer exists (and any edges that touch
        them), so a deleted stage never lingers on the canvas;
      * report stages that have no node yet as ``unplaced_stages`` so the UI can
        offer them in the tray.
    """
    valid_ids = {s.id for s in stages}

    kept_nodes = [
        n for n in graph.nodes
        if n.type != "stage" or n.stage_id in valid_ids
    ]
    kept_node_ids = {n.id for n in kept_nodes}
    kept_edges = [
        e for e in graph.edges
        if e.source in kept_node_ids and e.target in kept_node_ids
    ]

    placed_stage_ids = {n.stage_id for n in kept_nodes if n.type == "stage"}
    unplaced = [s for s in stages if s.id not in placed_stage_ids]

    return FlowchartOut(
        graph=FlowchartGraph(nodes=kept_nodes, edges=kept_edges),
        unplaced_stages=unplaced,
    )


async def get_flowchart(db: AsyncSession, tenant_id: uuid.UUID) -> FlowchartOut:
    """Return the tenant's chart reconciled against the current stage list, or an
    empty chart (every stage unplaced) when none has been drawn yet."""
    stages = await list_stages(db, tenant_id)
    row = await db.scalar(
        select(PipelineFlowchart).where(PipelineFlowchart.tenant_id == tenant_id)
    )
    stored = FlowchartGraph.model_validate(row.graph) if row else FlowchartGraph()
    return reconcile_flowchart(stored, stages)


async def upsert_flowchart(
    db: AsyncSession, tenant_id: uuid.UUID, graph: FlowchartGraph
) -> FlowchartOut:
    """Persist the whole graph (one row per tenant), then return it reconciled.

    Stage nodes are dropped on the way in if they point at a stage that no longer
    exists, so a stale reference can't be saved back. Stage create/rename/delete
    still flow through the existing stage CRUD endpoints — this only stores layout.
    """
    stages = await list_stages(db, tenant_id)
    reconciled = reconcile_flowchart(graph, stages)
    payload = reconciled.graph.model_dump(mode="json")

    row = await db.scalar(
        select(PipelineFlowchart).where(PipelineFlowchart.tenant_id == tenant_id)
    )
    if row is None:
        row = PipelineFlowchart(tenant_id=tenant_id, graph=payload)
        db.add(row)
    else:
        row.graph = payload
    await db.commit()
    return reconciled


# ──────────────────────────────────────────────────────────────
# [KAN_FLOW2] Feed the chart to the brain — Yip context + automation suggestions
# ──────────────────────────────────────────────────────────────

async def _load_graph_and_stage_names(
    db: AsyncSession, tenant_id: uuid.UUID
) -> tuple[FlowchartGraph, dict[uuid.UUID, str]]:
    """Fetch the tenant's reconciled chart plus a stage_id → name map.

    Shared by the Yip serialiser and the suggestion builder so they always see
    the same reconciled view (deleted stages already dropped)."""
    out = await get_flowchart(db, tenant_id)
    stages = await list_stages(db, tenant_id)
    stage_names = {s.id: s.name for s in stages}
    return out.graph, stage_names


async def flowchart_context_text(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """[KAN_FLOW2] The tenant's pipeline chart as compact prompt-ready text, or an
    empty string when no meaningful chart has been drawn. Consumed by Yip's system
    prompt so the assistant understands how this tenant's pipeline actually works."""
    graph, stage_names = await _load_graph_and_stage_names(db, tenant_id)
    return flowchart_to_text(graph, stage_names)


def build_flowchart_suggestions(
    graph: FlowchartGraph, stage_names: dict[uuid.UUID, str]
) -> list[FlowchartSuggestion]:
    """[KAN_FLOW2] Deterministically map chart edges to draft automation
    suggestions the Flows UI can open prefilled.

    Pure — no DB. Mapping rules:
      * A stage node reached FROM another stage node (directly, or via a decision
        diamond in between) becomes a suggestion. The trigger is the real
        ``pipeline_stage_changed`` trigger declared by the pipeline flow registry,
        prefilled with a stage_id condition on the SOURCE stage; the target stage
        is carried so the Flows builder can prefill a move_pipeline_stage action.
      * A decision diamond between two stages contributes its question and the
        edge's yes/no (or free text) label as a human readable condition
        description, so "New lead -> [Replied?] no (5 days) -> Cold" reads back as
        one suggestion from New lead to Cold when Replied? is no.
      * Suggestions are de-duplicated on (source stage, target stage, condition
        text) and ordered deterministically so the panel is stable.
    """
    nodes_by_id = {n.id: n for n in graph.nodes}
    # Outgoing edges per node, so we can hop stage -> decision -> stage.
    out_edges: dict[str, list] = {}
    for e in graph.edges:
        out_edges.setdefault(e.source, []).append(e)

    def stage_of(node_id: str):
        node = nodes_by_id.get(node_id)
        if node is None or node.type != "stage" or node.stage_id is None:
            return None
        return node

    suggestions: list[FlowchartSuggestion] = []
    seen: set[tuple] = set()

    def add(source_node, target_node, condition_bits: list[str]) -> None:
        src_id = source_node.stage_id
        tgt_id = target_node.stage_id
        if src_id is None or tgt_id is None or src_id == tgt_id:
            return
        src_name = stage_names.get(src_id, "a stage")
        tgt_name = stage_names.get(tgt_id, "a stage")
        condition = " — ".join([b for b in condition_bits if b]) or None
        key = (str(src_id), str(tgt_id), condition or "")
        if key in seen:
            return
        seen.add(key)

        title = f"Automate: {src_name} → {tgt_name}"
        if condition:
            description = (
                f"When a contact enters the {src_name} stage and {condition}, "
                f"move them to {tgt_name}."
            )
        else:
            description = (
                f"When a contact enters the {src_name} stage, move them to {tgt_name}."
            )
        # Stable, process-independent id (Python's str hash is salted per run).
        cond_digest = hashlib.sha1(key[2].encode("utf-8")).hexdigest()[:8]
        suggestions.append(
            FlowchartSuggestion(
                id=f"kanflow_{key[0]}_{key[1]}_{cond_digest}",
                title=title,
                description=description,
                condition_description=condition,
                source_stage_id=src_id,
                source_stage_name=src_name,
                target_stage_id=tgt_id,
                target_stage_name=tgt_name,
                trigger_type="pipeline_stage_changed",
                trigger_config={},
                conditions=[{"field": "stage_id", "op": "equals", "value": str(src_id)}],
            )
        )

    for edge in graph.edges:
        source = stage_of(edge.source)
        if source is None:
            continue
        target_node = nodes_by_id.get(edge.target)
        if target_node is None:
            continue

        if target_node.type == "stage":
            # Direct stage -> stage arrow. Any free text label is the condition.
            label = (edge.label or "").strip()
            add(source, target_node, [label])
        elif target_node.type == "decision":
            # stage -> [decision] -> stage(s). Fan out over the diamond's branches.
            question = (target_node.label or "").strip()
            for branch in out_edges.get(target_node.id, []):
                branch_target = stage_of(branch.target)
                if branch_target is None:
                    continue
                branch_label = (branch.label or "").strip()
                bits = []
                if question:
                    bits.append(
                        f"{question} is {branch_label}" if branch_label else question
                    )
                elif branch_label:
                    bits.append(branch_label)
                # Carry the diamond's inbound edge label too (rare, but keeps
                # "New lead (5 days) -> [Replied?]" context if drawn that way).
                inbound = (edge.label or "").strip()
                if inbound:
                    bits.append(inbound)
                add(source, branch_target, bits)

    # Deterministic ordering: by title then description.
    suggestions.sort(key=lambda s: (s.title, s.description))
    return suggestions


async def get_flowchart_suggestions(
    db: AsyncSession, tenant_id: uuid.UUID
) -> list[FlowchartSuggestion]:
    """[KAN_FLOW2] Build automation suggestions from the tenant's live chart."""
    graph, stage_names = await _load_graph_and_stage_names(db, tenant_id)
    return build_flowchart_suggestions(graph, stage_names)
