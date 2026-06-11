"""add email_signature to users (per-user signature, item: signatures)

Revision ID: d1e2f3a4b5c6
Revises: c0d1e2f3a4b5
Create Date: 2026-06-11

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'd1e2f3a4b5c6'
down_revision: Union[str, None] = 'c0d1e2f3a4b5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email_signature TEXT")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS email_signature")
