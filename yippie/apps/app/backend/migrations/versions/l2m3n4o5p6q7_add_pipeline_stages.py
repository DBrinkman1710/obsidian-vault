"""Add pipeline_stages and contact_pipeline_entries tables

Revision ID: l2m3n4o5p6q7
Revises: k1l2m3n4o5p6
Create Date: 2026-06-13

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'l2m3n4o5p6q7'
down_revision: Union[str, None] = 'k1l2m3n4o5p6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS pipeline_stages (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            name VARCHAR(100) NOT NULL,
            color VARCHAR(7) NOT NULL DEFAULT '#64748b',
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_pipeline_stages_tenant_id ON pipeline_stages (tenant_id)")
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS contact_pipeline_entries (
            contact_id UUID PRIMARY KEY REFERENCES contacts(id) ON DELETE CASCADE,
            stage_id UUID NOT NULL REFERENCES pipeline_stages(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL,
            entered_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_contact_pipeline_entries_stage_id ON contact_pipeline_entries (stage_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_contact_pipeline_entries_tenant_id ON contact_pipeline_entries (tenant_id)")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS contact_pipeline_entries")
    op.execute("DROP TABLE IF EXISTS pipeline_stages")
