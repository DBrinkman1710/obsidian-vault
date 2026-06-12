"""add label_click_tokens table and pending_sends campaign columns (Phase 9C)

Revision ID: h8i9j0k1l2m3
Revises: g7h8i9j0k1l2
Create Date: 2026-06-12

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'h8i9j0k1l2m3'
down_revision: Union[str, None] = 'g7h8i9j0k1l2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS label_click_tokens (
            token UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
            label_id UUID NOT NULL REFERENCES contact_labels(id) ON DELETE CASCADE,
            button_id VARCHAR(36) NOT NULL,
            used_at TIMESTAMPTZ,
            created_at TIMESTAMPTZ DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_label_click_tokens_tenant_id ON label_click_tokens (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_label_click_tokens_contact_id ON label_click_tokens (contact_id)")
    op.execute("ALTER TABLE pending_sends ADD COLUMN IF NOT EXISTS campaign_buttons_json TEXT")
    op.execute("ALTER TABLE pending_sends ADD COLUMN IF NOT EXISTS prerendered_html TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE pending_sends DROP COLUMN IF EXISTS prerendered_html")
    op.execute("ALTER TABLE pending_sends DROP COLUMN IF EXISTS campaign_buttons_json")
    op.execute("DROP TABLE IF EXISTS label_click_tokens")
