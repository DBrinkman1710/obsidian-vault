"""add per-user reply_from_email and from_email to pending_sends

Revision ID: e2f3a4b5c6d7
Revises: d0e1f2a3b4c5
Create Date: 2026-06-09

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op

revision: str = 'e2f3a4b5c6d7'
down_revision: Union[str, None] = 'd0e1f2a3b4c5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS reply_from_email VARCHAR(255)")
    op.execute("ALTER TABLE pending_sends ADD COLUMN IF NOT EXISTS from_email VARCHAR(255)")


def downgrade() -> None:
    op.execute("ALTER TABLE pending_sends DROP COLUMN IF EXISTS from_email")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS reply_from_email")
