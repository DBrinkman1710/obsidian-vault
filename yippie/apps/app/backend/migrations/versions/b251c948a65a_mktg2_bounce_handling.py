"""MKTG2 — Bounce handling: contact_bounces table

Revision ID: b251c948a65a
Revises: ud1e2f3a4b5c
Create Date: 2026-06-21

Adds the contact_bounces table for recording hard/soft bounces per contact.
Protected by tenant_isolation RLS. Index on (tenant_id, contact_id).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "b251c948a65a"
down_revision: Union[str, None] = "ud1e2f3a4b5c"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS contact_bounces (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            contact_id UUID REFERENCES contacts(id) ON DELETE CASCADE,
            campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
            bounce_type VARCHAR(50),
            bounced_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_contact_bounces_tenant_contact "
        "ON contact_bounces (tenant_id, contact_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_contact_bounces_campaign "
        "ON contact_bounces (campaign_id)"
    )

    # RLS: tenant_isolation
    op.execute("ALTER TABLE contact_bounces ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE contact_bounces FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON contact_bounces")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON contact_bounces
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON contact_bounces TO app_user")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON contact_bounces")
    op.execute("ALTER TABLE contact_bounces NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE contact_bounces DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS contact_bounces")
