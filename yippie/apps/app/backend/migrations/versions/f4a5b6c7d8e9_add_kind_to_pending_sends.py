"""add kind to pending_sends — distinguishes reply vs compose for activity logging

Revision ID: f4a5b6c7d8e9
Revises: e2f3a4b5c6d7
Create Date: 2026-06-10

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'f4a5b6c7d8e9'
down_revision: Union[str, None] = 'e2f3a4b5c6d7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent — devsandbox and sandbox deploy concurrently against the shared DB
    op.execute("ALTER TABLE pending_sends ADD COLUMN IF NOT EXISTS kind VARCHAR(20) NOT NULL DEFAULT 'reply'")


def downgrade() -> None:
    op.execute("ALTER TABLE pending_sends DROP COLUMN IF EXISTS kind")
