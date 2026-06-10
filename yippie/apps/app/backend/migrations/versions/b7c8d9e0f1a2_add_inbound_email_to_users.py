"""add inbound_email to users — personal inbox receiving address

Revision ID: b7c8d9e0f1a2
Revises: a5b6c7d8e9f0
Create Date: 2026-06-10

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b7c8d9e0f1a2'
down_revision: Union[str, None] = 'a5b6c7d8e9f0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent — devsandbox and sandbox deploy concurrently against the shared DB
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS inbound_email VARCHAR(255)")
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_users_inbound_email ON users (inbound_email)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS uq_users_inbound_email")
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS inbound_email")
