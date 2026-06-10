"""add deleted_at to tickets — soft delete, history preserved

Revision ID: a5b6c7d8e9f0
Revises: f4a5b6c7d8e9
Create Date: 2026-06-10

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a5b6c7d8e9f0'
down_revision: Union[str, None] = 'f4a5b6c7d8e9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent — devsandbox and sandbox deploy concurrently against the shared DB
    op.execute("ALTER TABLE tickets ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ")


def downgrade() -> None:
    op.execute("ALTER TABLE tickets DROP COLUMN IF EXISTS deleted_at")
