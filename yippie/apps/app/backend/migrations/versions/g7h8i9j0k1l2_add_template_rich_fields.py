"""add rich design fields to response_templates

Revision ID: g7h8i9j0k1l2
Revises: d4e5f6a7b8c9
Create Date: 2026-06-12

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'g7h8i9j0k1l2'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE response_templates ADD COLUMN IF NOT EXISTS design_json TEXT")
    op.execute("ALTER TABLE response_templates ADD COLUMN IF NOT EXISTS html_body TEXT")
    op.execute("ALTER TABLE response_templates ADD COLUMN IF NOT EXISTS campaign_buttons JSONB DEFAULT '[]'")


def downgrade() -> None:
    op.execute("ALTER TABLE response_templates DROP COLUMN IF EXISTS campaign_buttons")
    op.execute("ALTER TABLE response_templates DROP COLUMN IF EXISTS html_body")
    op.execute("ALTER TABLE response_templates DROP COLUMN IF EXISTS design_json")
