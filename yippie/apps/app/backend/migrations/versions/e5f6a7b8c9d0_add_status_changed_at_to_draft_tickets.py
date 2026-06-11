"""add status_changed_at to draft_tickets (spam/bin retention, item 42)

Revision ID: e5f6a7b8c9d0
Revises: d1e2f3a4b5c6
Create Date: 2026-06-11

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd1e2f3a4b5c6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE draft_tickets ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE draft_tickets DROP COLUMN IF EXISTS status_changed_at")
