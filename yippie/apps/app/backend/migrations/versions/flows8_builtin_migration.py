"""[FLOW8] Migrate four hardcoded automations into editable flows + drop their columns.

Backfills, for every existing tenant:
  * "Notify the assigned agent before SLA breach"  (retires the Yip SLA nudge job)
  * "Escalate tickets before SLA breach"           (retires the SLA escalation job)
and, per tenant that had one configured:
  * "Move contact after booking"       from calendar_settings.post_booking_stage_id
  * "Order placed → pipeline stage"    from tenants.order_placed_stage_id
  * "Order shipped → pipeline stage"   from tenants.order_shipped_stage_id
  * "Order delivered → pipeline stage" from tenants.order_delivered_stage_id

Then drops the now-unused source columns. Source columns are READ before dropping.
Idempotent-ish on the two universal flows: a flow is inserted only when the tenant
doesn't already have one of that exact name (so re-running after seed installed
them stays clean).

Revision ID: flows8_builtin_migration
Revises: trial30_trial_fields
Create Date: 2026-07-09
"""
from __future__ import annotations

import uuid
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = 'flows8_builtin_migration'
down_revision: Union[str, None] = 'trial30_trial_fields'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Lightweight table def matching the columns we write (see flows.models.Flow).
# created_at/updated_at have server defaults; last_scheduled_on/webhook_token/
# last_run_at are nullable and left unset.
_flows = sa.table(
    "flows",
    sa.column("id", UUID(as_uuid=True)),
    sa.column("tenant_id", UUID(as_uuid=True)),
    sa.column("name", sa.String),
    sa.column("enabled", sa.Boolean),
    sa.column("trigger_type", sa.String),
    sa.column("conditions", JSONB),
    sa.column("actions", JSONB),
    sa.column("trigger_config", JSONB),
    sa.column("created_by", UUID(as_uuid=True)),
    sa.column("run_count", sa.Integer),
)

# The two universal default flows (must match flows.service.DEFAULT_FLOWS).
# _action() stamps a fresh action id per inserted row.
_UNIVERSAL = [
    {
        "name": "Notify the assigned agent before SLA breach",
        "trigger_type": "ticket_sla_due_soon",
        "action_type": "notify_user",
        "config": {
            "recipient": "assigned agent",
            "message": 'Ticket "{subject}" SLA is due in {due_in_minutes} minutes.',
        },
    },
    {
        "name": "Escalate tickets before SLA breach",
        "trigger_type": "ticket_sla_due_soon",
        "action_type": "update_ticket",
        "config": {"priority": "urgent"},
    },
]


def _action(action_type: str, config: dict) -> list:
    return [{"id": uuid.uuid4().hex, "type": action_type, "config": config}]


def _row(tenant_id, name, trigger_type, conditions, actions) -> dict:
    return {
        "id": uuid.uuid4(),
        "tenant_id": tenant_id,
        "name": name,
        "enabled": True,
        "trigger_type": trigger_type,
        "conditions": conditions,
        "actions": actions,
        "trigger_config": {},
        "created_by": None,
        "run_count": 0,
    }


def upgrade() -> None:
    bind = op.get_bind()

    rows: list[dict] = []

    # --- B1 + B2: two universal flows for every tenant (skip if name exists) ---
    tenants = bind.execute(sa.text(
        "SELECT id, order_placed_stage_id, order_shipped_stage_id, "
        "order_delivered_stage_id FROM tenants"
    )).fetchall()

    existing_names = {
        (r[0], r[1])
        for r in bind.execute(sa.text("SELECT tenant_id, name FROM flows")).fetchall()
    }

    for t in tenants:
        tenant_id = t[0]
        for spec in _UNIVERSAL:
            if (tenant_id, spec["name"]) in existing_names:
                continue
            rows.append(_row(
                tenant_id, spec["name"], spec["trigger_type"],
                [],
                _action(spec["action_type"], spec["config"]),
            ))

        # --- B4: ERP order-status → pipeline stage flows (one per set column) ---
        placed, shipped, delivered = t[1], t[2], t[3]
        if placed is not None:
            rows.append(_row(
                tenant_id, "Order placed → pipeline stage", "order_received",
                [[{"field": "status", "op": "equals", "value": "registered"}]],
                _action("move_pipeline_stage", {"stage_id": str(placed)}),
            ))
        if shipped is not None:
            rows.append(_row(
                tenant_id, "Order shipped → pipeline stage", "order_received",
                [[{"field": "status", "op": "in",
                   "value": ["in_transit", "out_for_delivery"]}]],
                _action("move_pipeline_stage", {"stage_id": str(shipped)}),
            ))
        if delivered is not None:
            rows.append(_row(
                tenant_id, "Order delivered → pipeline stage", "order_received",
                [[{"field": "status", "op": "equals", "value": "delivered"}]],
                _action("move_pipeline_stage", {"stage_id": str(delivered)}),
            ))

    # --- B3: booking post-booking stage flow, per tenant that had one set ---
    booking_settings = bind.execute(sa.text(
        "SELECT tenant_id, post_booking_stage_id FROM calendar_settings "
        "WHERE post_booking_stage_id IS NOT NULL"
    )).fetchall()
    for cs in booking_settings:
        tenant_id, stage_id = cs[0], cs[1]
        rows.append(_row(
            tenant_id, "Move contact after booking", "booking_created",
            [],
            _action("move_pipeline_stage", {"stage_id": str(stage_id)}),
        ))

    if rows:
        op.bulk_insert(_flows, rows)

    # --- drop the now-unused source columns ---
    op.drop_column("calendar_settings", "post_booking_stage_id")
    op.drop_column("tenants", "order_placed_stage_id")
    op.drop_column("tenants", "order_shipped_stage_id")
    op.drop_column("tenants", "order_delivered_stage_id")


def downgrade() -> None:
    # Re-add the columns (nullable; data restore is not required) and remove the
    # flows this migration inserted, by their exact names.
    op.add_column(
        "tenants",
        sa.Column("order_delivered_stage_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("order_shipped_stage_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "tenants",
        sa.Column("order_placed_stage_id", UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "calendar_settings",
        sa.Column("post_booking_stage_id", UUID(as_uuid=True), nullable=True),
    )

    op.execute(sa.text(
        "DELETE FROM flows WHERE name IN ("
        "'Notify the assigned agent before SLA breach',"
        "'Escalate tickets before SLA breach',"
        "'Move contact after booking',"
        "'Order placed → pipeline stage',"
        "'Order shipped → pipeline stage',"
        "'Order delivered → pipeline stage'"
        ")"
    ))
