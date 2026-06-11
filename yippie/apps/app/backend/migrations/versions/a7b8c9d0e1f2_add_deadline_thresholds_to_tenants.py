"""add deadline thresholds to tenants (per-tenant ticket deadline indicator)

Revision ID: a7b8c9d0e1f2
Revises: f6a7b8c9d0e1
Create Date: 2026-06-11

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'a7b8c9d0e1f2'
down_revision: Union[str, None] = 'f6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Red dot = tickets overdue or due within this many days (today/tomorrow).
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deadline_red_days INTEGER NOT NULL DEFAULT 1")
    # Orange dot = tickets due within this many days (beyond the red window).
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS deadline_orange_days INTEGER NOT NULL DEFAULT 2")


def downgrade() -> None:
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS deadline_orange_days")
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS deadline_red_days")
