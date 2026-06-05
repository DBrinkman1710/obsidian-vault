"""add inbound_to to inbound_messages for per-env inbox isolation

Revision ID: a6b7c8d9e0f1
Revises: f5a6b7c8d9e0
Create Date: 2026-06-05

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'a6b7c8d9e0f1'
down_revision: Union[str, None] = 'f5a6b7c8d9e0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE inbound_messages ADD COLUMN IF NOT EXISTS "
        "inbound_to VARCHAR(255)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_inbound_messages_inbound_to "
        "ON inbound_messages (inbound_to)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_inbound_messages_inbound_to")
    op.execute("ALTER TABLE inbound_messages DROP COLUMN IF EXISTS inbound_to")
