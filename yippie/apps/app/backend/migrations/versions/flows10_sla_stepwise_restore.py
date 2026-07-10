"""[SLA restore] Move existing tenants' SLA escalation flow back to stepwise post breach.

FLOW8 (migration ``flows8_builtin_migration``) retired the old stepwise SLA
escalation job — which climbed an overdue ticket's priority one notch per tick,
low→…→urgent, only while it stayed open/in_progress AFTER the SLA breach — and
replaced it, for every existing tenant, with a default flow "Escalate tickets
before SLA breach" that fired ONCE, straight to urgent, ~60 minutes BEFORE the
breach.

The owner wants the old behaviour restored. This data migration rewrites each
existing tenant's migrated SLA escalation flow back to a STEPWISE escalation
expressed as flow steps (branch on fresh state → raise to high → wait → branch
again → raise to urgent), so a ticket steps up in priority over time and stops
climbing once it is no longer open/in_progress — the flow-expressible
reconstruction of the retired job's semantics.

The one-shot "urgent 60 min before breach" variant is NOT deleted: it survives as
the opt-in recipe ``escalate_before_sla_breach`` (flows/recipes.py) that a new
setup can install if it prefers that behaviour. New tenants now get the stepwise
flow (service.DEFAULT_FLOWS + seed.py / admin.create_tenant).

Only flows that still carry FLOW8's exact one-shot shape (a single
``update_ticket`` → ``priority: urgent`` action) and were installed by the
platform (``created_by IS NULL``) are rewritten — a tenant that edited or renamed
their flow is left untouched. Idempotent: re-running finds nothing left to change.

Revision ID: flows10_sla_stepwise_restore
Revises: flows9_default_flag
Create Date: 2026-07-09
"""
from __future__ import annotations

import json
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'flows10_sla_stepwise_restore'
down_revision: Union[str, None] = 'flows9_default_flag'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


_FLOW_NAME = "Escalate tickets before SLA breach"

# FLOW8's one-shot shape (a single update_ticket → urgent). Matched loosely (one
# action, that type, that priority) so a client-minted action id doesn't block it.
_ONESHOT_ACTION_TYPE = "update_ticket"
_ONESHOT_PRIORITY = "urgent"


def _stepwise_graph() -> dict:
    """The stepwise escalation graph — imported from the service so the migration
    and the runtime default stay one source of truth. Falls back to an inline copy
    if the import path ever moves (migrations must keep applying on old code)."""
    try:
        from app.modules.flows.service import stepwise_sla_escalation_graph

        return stepwise_sla_escalation_graph()
    except Exception:  # pragma: no cover - defensive for future refactors
        still_open = [[{"field": "status", "op": "in", "value": ["open", "in_progress"]}]]
        return {
            "nodes": [
                {"id": "check_open_1", "type": "branch", "config": {"conditions": still_open}},
                {"id": "to_high", "type": "update_ticket", "config": {"priority": "high"}},
                {"id": "wait_1", "type": "wait", "config": {"minutes": 5}},
                {"id": "check_open_2", "type": "branch", "config": {"conditions": still_open}},
                {"id": "to_urgent", "type": "update_ticket", "config": {"priority": "urgent"}},
            ],
            "edges": [
                {"from": "check_open_1", "to": "to_high", "when": "match"},
                {"from": "to_high", "to": "wait_1", "when": None},
                {"from": "wait_1", "to": "check_open_2", "when": None},
                {"from": "check_open_2", "to": "to_urgent", "when": "match"},
            ],
        }


def _is_oneshot_actions(actions) -> bool:
    """Whether a flow's stored ``actions`` is FLOW8's one-shot update→urgent list."""
    if not isinstance(actions, list) or len(actions) != 1:
        return False
    action = actions[0]
    if not isinstance(action, dict):
        return False
    config = action.get("config") or {}
    return (
        action.get("type") == _ONESHOT_ACTION_TYPE
        and str(config.get("priority")) == _ONESHOT_PRIORITY
    )


def upgrade() -> None:
    bind = op.get_bind()
    graph_json = json.dumps(_stepwise_graph())

    rows = bind.execute(sa.text(
        "SELECT id, actions FROM flows "
        "WHERE name = :name AND trigger_type = 'ticket_sla_due_soon' "
        "AND created_by IS NULL"
    ), {"name": _FLOW_NAME}).fetchall()

    updated = 0
    for row in rows:
        flow_id, actions = row[0], row[1]
        # actions is JSONB — the driver may hand it back as a str or already parsed.
        if isinstance(actions, str):
            try:
                actions = json.loads(actions)
            except ValueError:
                actions = None
        if not _is_oneshot_actions(actions):
            continue  # already stepwise, or a tenant customised it — leave alone
        bind.execute(
            sa.text("UPDATE flows SET actions = CAST(:actions AS JSONB) WHERE id = :id"),
            {"actions": graph_json, "id": flow_id},
        )
        updated += 1

    if updated:
        print(f"[flows10] restored stepwise SLA escalation on {updated} flow(s)")


def downgrade() -> None:
    # Revert the stepwise graph back to FLOW8's one-shot update_ticket → urgent for
    # the platform-installed SLA escalation flows this migration rewrote.
    bind = op.get_bind()
    oneshot = json.dumps([{"type": "update_ticket", "config": {"priority": "urgent"}}])

    rows = bind.execute(sa.text(
        "SELECT id, actions FROM flows "
        "WHERE name = :name AND trigger_type = 'ticket_sla_due_soon' "
        "AND created_by IS NULL"
    ), {"name": _FLOW_NAME}).fetchall()

    for row in rows:
        flow_id, actions = row[0], row[1]
        if isinstance(actions, str):
            try:
                actions = json.loads(actions)
            except ValueError:
                actions = None
        # Only revert the graph shape this migration installed (a dict with our
        # stepwise node ids) — never touch a tenant's own edited flow.
        if not (isinstance(actions, dict) and any(
            n.get("id") == "check_open_1" for n in (actions.get("nodes") or [])
        )):
            continue
        bind.execute(
            sa.text("UPDATE flows SET actions = CAST(:actions AS JSONB) WHERE id = :id"),
            {"actions": oneshot, "id": flow_id},
        )
