"""MKTG1 — marketing module: 5 tenant-scoped tables with RLS

Revision ID: em1k2t3g4h5j
Revises: dr1e2f3a4b5c
Create Date: 2026-06-21

Creates campaigns, campaign_templates, campaign_analytics, campaign_sequences,
and contact_unsubscribes. Each carries tenant_id and is protected by the
standard tenant_isolation RLS policy (see n4o5p6q7r8s9). The app_user role and
app_tenant_id() helper already exist from c3d4e5f6a7b8.

campaign_templates has no tenant_id of its own — it is isolated through a
subquery join to its parent campaign (same approach as contact_label_links).

asyncpg requires one SQL command per op.execute() (extended query protocol).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "em1k2t3g4h5j"
down_revision: Union[str, None] = "dr1e2f3a4b5c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tables with a direct tenant_id column → standard tenant_isolation policy.
TENANT_TABLES = [
    "campaigns",
    "campaign_analytics",
    "campaign_sequences",
    "contact_unsubscribes",
]


def upgrade() -> None:
    # --- campaigns ---------------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS campaigns (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            name TEXT NOT NULL,
            subject TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'draft',
            scheduled_at TIMESTAMPTZ,
            dispatch_channel VARCHAR(20) NOT NULL DEFAULT 'email',
            ab_winner VARCHAR(1),
            segment_filter JSONB,
            dispatched_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_campaigns_tenant ON campaigns (tenant_id)")

    # --- campaign_templates ------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS campaign_templates (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            raw_html TEXT,
            raw_css TEXT,
            variant VARCHAR(1)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_campaign_templates_campaign "
        "ON campaign_templates (campaign_id)"
    )

    # --- campaign_analytics ------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS campaign_analytics (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            recipient_email TEXT NOT NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'sent',
            tracking_token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
            variant VARCHAR(1),
            reply_classification TEXT,
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_campaign_analytics_tenant "
        "ON campaign_analytics (tenant_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_campaign_analytics_campaign "
        "ON campaign_analytics (campaign_id)"
    )

    # --- campaign_sequences ------------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS campaign_sequences (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
            delay_days INTEGER NOT NULL,
            subject TEXT NOT NULL,
            html_body TEXT NOT NULL,
            sent_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_campaign_sequences_tenant "
        "ON campaign_sequences (tenant_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_campaign_sequences_campaign "
        "ON campaign_sequences (campaign_id)"
    )

    # --- contact_unsubscribes ----------------------------------------------
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS contact_unsubscribes (
            contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL,
            unsubscribed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            PRIMARY KEY (contact_id, tenant_id)
        )
        """
    )

    # --- RLS: tenant_id-bearing tables -------------------------------------
    for table in TENANT_TABLES:
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

    # --- RLS: campaign_templates (no tenant_id → join through campaign) ----
    op.execute("ALTER TABLE campaign_templates ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE campaign_templates FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON campaign_templates")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON campaign_templates
            USING (
                EXISTS (
                    SELECT 1 FROM campaigns c
                    WHERE c.id = campaign_templates.campaign_id
                      AND c.tenant_id = app_tenant_id()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM campaigns c
                    WHERE c.id = campaign_templates.campaign_id
                      AND c.tenant_id = app_tenant_id()
                )
            )
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON campaign_templates TO app_user")

    # Enable the marketing module for existing tenants (new tenants default to ALL_MODULES).
    op.execute(
        "UPDATE tenants SET enabled_modules = array_append(enabled_modules, 'marketing') "
        "WHERE NOT ('marketing' = ANY(enabled_modules))"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE tenants SET enabled_modules = array_remove(enabled_modules, 'marketing') "
        "WHERE 'marketing' = ANY(enabled_modules)"
    )
    for table in ["campaign_templates", *TENANT_TABLES]:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS contact_unsubscribes")
    op.execute("DROP TABLE IF EXISTS campaign_sequences")
    op.execute("DROP TABLE IF EXISTS campaign_analytics")
    op.execute("DROP TABLE IF EXISTS campaign_templates")
    op.execute("DROP TABLE IF EXISTS campaigns")
