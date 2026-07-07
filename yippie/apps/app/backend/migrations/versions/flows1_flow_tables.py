"""flows1 — flows, flow_runs and flow_events tables (Flows module, phase 1)

Revision ID: flows1_flow_tables
Revises: yip6_jarvis_threads
Create Date: 2026-07-07

Free core Flows module: tenant configurable trigger → condition → action
automations. `flows` stores the rules, `flow_runs` the per event audit log,
`flow_events` is the transactional outbox written alongside the triggering
mutation and drained by the flow engine scheduler. trigger_type / status are
plain VARCHARs (validated at the app layer) so new values never need ALTER TYPE.
Also enables the module for every existing tenant (core module, on for all).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "flows1_flow_tables"
down_revision: Union[str, None] = "yip6_jarvis_threads"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS flows (
            id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id    UUID         NOT NULL,
            name         VARCHAR(255) NOT NULL,
            enabled      BOOLEAN      NOT NULL DEFAULT true,
            trigger_type VARCHAR(50)  NOT NULL,
            conditions   JSONB        NOT NULL DEFAULT '[]',
            actions      JSONB        NOT NULL DEFAULT '[]',
            created_by   UUID         REFERENCES users(id) ON DELETE SET NULL,
            run_count    INTEGER      NOT NULL DEFAULT 0,
            last_run_at  TIMESTAMPTZ,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_flows_tenant_trigger "
        "ON flows (tenant_id, trigger_type)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS flow_runs (
            id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id  UUID        NOT NULL,
            flow_id    UUID        NOT NULL REFERENCES flows(id) ON DELETE CASCADE,
            event      JSONB       NOT NULL DEFAULT '{}',
            status     VARCHAR(20) NOT NULL,
            results    JSONB       NOT NULL DEFAULT '[]',
            error      TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_flow_runs_tenant_flow_created "
        "ON flow_runs (tenant_id, flow_id, created_at DESC)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS flow_events (
            id           UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id    UUID         NOT NULL,
            event_type   VARCHAR(50)  NOT NULL,
            entity_type  VARCHAR(50)  NOT NULL,
            entity_id    UUID,
            contact_id   UUID,
            actor_id     UUID,
            payload      JSONB        NOT NULL DEFAULT '{}',
            source       VARCHAR(20)  NOT NULL DEFAULT 'app',
            processed_at TIMESTAMPTZ,
            created_at   TIMESTAMPTZ  NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_flow_events_unprocessed "
        "ON flow_events (created_at) WHERE processed_at IS NULL"
    )

    # Row-level security — tenant isolation, consistent with every other table.
    for table in ("flows", "flow_runs", "flow_events"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
                USING     (tenant_id = app_tenant_id())
                WITH CHECK (tenant_id = app_tenant_id())
            """
        )
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO app_user")

    # Core module: switch it on for every existing tenant.
    op.execute(
        "UPDATE tenants SET enabled_modules = array_append(enabled_modules, 'flows') "
        "WHERE NOT ('flows' = ANY(enabled_modules))"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS flow_events")
    op.execute("DROP TABLE IF EXISTS flow_runs")
    op.execute("DROP TABLE IF EXISTS flows")
    op.execute(
        "UPDATE tenants SET enabled_modules = array_remove(enabled_modules, 'flows') "
        "WHERE 'flows' = ANY(enabled_modules)"
    )
