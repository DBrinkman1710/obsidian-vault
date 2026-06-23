"""sales1 — saas_events, saas_identity, saas_health tables + Tenant.tracking_token

Revision ID: 207c10c02c3e
Revises: b3c4d5e6f7a8
Create Date: 2026-06-23

Shared ingest infrastructure for [SALES-MOD1] (commerce tracking) and
[SAAS-MOD1] (SaaS product analytics):

  saas_events       — one row per tracked event; event_domain='commerce'|'saas'
  saas_identity     — maps anonymous_id → contact_id once identify() fires
  saas_health       — per-contact health score (0-100), recomputed hourly

Also adds Tenant.tracking_token (UUID) — the data-token in the JS snippet.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "207c10c02c3e"
down_revision: Union[str, None] = "b3c4d5e6f7a8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tenant.tracking_token — stable per-tenant token for JS snippet auth
    op.execute(
        """
        ALTER TABLE tenants
            ADD COLUMN IF NOT EXISTS tracking_token UUID DEFAULT gen_random_uuid()
        """
    )
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ix_tenants_tracking_token "
        "ON tenants (tracking_token)"
    )

    # saas_events — shared append-only event log for both commerce and saas snippets
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS saas_events (
            id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id     UUID        NOT NULL,
            contact_id    UUID        REFERENCES contacts(id) ON DELETE SET NULL,
            anonymous_id  TEXT        NOT NULL DEFAULT '',
            event_domain  VARCHAR(20) NOT NULL DEFAULT 'saas',
            event_type    TEXT        NOT NULL,
            properties    JSONB       NOT NULL DEFAULT '{}',
            session_id    TEXT,
            sdk_version   TEXT,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_saas_events_tenant_contact_type_time "
        "ON saas_events (tenant_id, contact_id, event_type, created_at)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_saas_events_tenant_anon "
        "ON saas_events (tenant_id, anonymous_id)"
    )
    op.execute("ALTER TABLE saas_events ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE saas_events FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON saas_events")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON saas_events
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON saas_events TO app_user")

    # saas_identity — maps anonymous session IDs to Yippie contacts after identify()
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS saas_identity (
            tenant_id       UUID        NOT NULL,
            anonymous_id    TEXT        NOT NULL,
            contact_id      UUID        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
            identified_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (tenant_id, anonymous_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_saas_identity_contact "
        "ON saas_identity (tenant_id, contact_id)"
    )
    op.execute("ALTER TABLE saas_identity ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE saas_identity FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON saas_identity")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON saas_identity
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON saas_identity TO app_user")

    # saas_health — denormalized health score per contact, updated by hourly job
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS saas_health (
            tenant_id           UUID    NOT NULL,
            contact_id          UUID    NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
            score               INT     NOT NULL DEFAULT 0,
            recency_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
            breadth_score       NUMERIC(5,2) NOT NULL DEFAULT 0,
            error_penalty       NUMERIC(5,2) NOT NULL DEFAULT 0,
            last_computed_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (tenant_id, contact_id)
        )
        """
    )
    op.execute("ALTER TABLE saas_health ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE saas_health FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON saas_health")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON saas_health
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON saas_health TO app_user")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS saas_health")
    op.execute("DROP TABLE IF EXISTS saas_identity")
    op.execute("DROP TABLE IF EXISTS saas_events")
    op.execute("DROP INDEX IF EXISTS ix_tenants_tracking_token")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS tracking_token")
