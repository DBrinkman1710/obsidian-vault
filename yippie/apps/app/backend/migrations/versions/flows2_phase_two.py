"""flows2 — pending steps + phase 2 columns (Flows module, phase 2)

Revision ID: flows2_phase_two
Revises: flows1_flow_tables
Create Date: 2026-07-08

Carries ALL of phase 2's DDL in one migration so the sibling phase 2 sessions
(OR groups, time triggers, saas health) stay migration free — no parallel head
races. `flow_pending_steps` is the durable resume queue for delay ("wait") steps
and action retries: the engine persists the remaining actions + frozen results
here and drains due rows on the same 10s tick. `flows.trigger_config` /
`last_scheduled_on` back the schedule trigger; `tickets.sla_flow_emitted_at`
dedups the SLA-due-soon emitter (both consumed in a later phase 2 session).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "flows2_phase_two"
down_revision: Union[str, None] = "flows1_flow_tables"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS flow_pending_steps (
            id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id  UUID        NOT NULL,
            flow_id    UUID        NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
            run_id     UUID        NOT NULL REFERENCES flow_runs(id) ON DELETE CASCADE,
            kind       VARCHAR(10) NOT NULL DEFAULT 'wait',
            event      JSONB       NOT NULL DEFAULT '{}',
            actions    JSONB       NOT NULL DEFAULT '[]',
            results    JSONB       NOT NULL DEFAULT '[]',
            attempt    INTEGER     NOT NULL DEFAULT 0,
            resume_at  TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_flow_pending_steps_resume "
        "ON flow_pending_steps (resume_at)"
    )

    # Row-level security — tenant isolation, consistent with flows1.
    op.execute("ALTER TABLE flow_pending_steps ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE flow_pending_steps FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON flow_pending_steps")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON flow_pending_steps
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON flow_pending_steps TO app_user")

    op.execute("ALTER TABLE flows ADD COLUMN IF NOT EXISTS trigger_config JSONB NOT NULL DEFAULT '{}'")
    op.execute("ALTER TABLE flows ADD COLUMN IF NOT EXISTS last_scheduled_on VARCHAR(10)")
    op.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS sla_flow_emitted_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS flow_pending_steps")
    op.execute("ALTER TABLE flows DROP COLUMN IF EXISTS trigger_config")
    op.execute("ALTER TABLE flows DROP COLUMN IF EXISTS last_scheduled_on")
    op.execute("ALTER TABLE tickets DROP COLUMN IF EXISTS sla_flow_emitted_at")
