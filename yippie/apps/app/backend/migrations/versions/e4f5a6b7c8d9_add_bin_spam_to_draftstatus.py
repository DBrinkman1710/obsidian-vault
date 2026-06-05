"""add bin and spam to draftstatus enum

Revision ID: e4f5a6b7c8d9
Revises: d3e4f5a6b7c8
Create Date: 2026-06-05

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'e4f5a6b7c8d9'
down_revision: Union[str, None] = 'd3e4f5a6b7c8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE draftstatus ADD VALUE IF NOT EXISTS 'bin'")
    op.execute("ALTER TYPE draftstatus ADD VALUE IF NOT EXISTS 'spam'")


def downgrade() -> None:
    pass  # Postgres does not support removing enum values
