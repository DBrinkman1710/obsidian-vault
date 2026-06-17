"""add auto_close_days to tenants (per-tenant stale-ticket auto-close)

Revision ID: c4d5e6f7a8b9
Revises: ef0754082c3f
Create Date: 2026-06-17

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'c4d5e6f7a8b9'
down_revision: Union[str, None] = 'ef0754082c3f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Hourly scheduler closes "waiting" tickets untouched for this many days.
    # Was previously a single global value in config/tenant.yaml; now per-tenant.
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS auto_close_days INTEGER NOT NULL DEFAULT 7")


def downgrade() -> None:
    op.execute("ALTER TABLE tenants DROP COLUMN IF EXISTS auto_close_days")
