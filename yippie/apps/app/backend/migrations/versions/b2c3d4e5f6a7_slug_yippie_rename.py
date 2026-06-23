"""Rename root tenant slug from 'default' to 'yippie'

Revision ID: 1217c5fedede
Revises: 37cf6ce94373
Create Date: 2026-06-23

One-time rename. seed.py now also syncs the slug on every deploy when
TENANT_ID env var changes, so this migration is a safe no-op on re-runs.
"""
from typing import Sequence, Union

from alembic import op

revision: str = '1217c5fedede'
down_revision: Union[str, None] = '37cf6ce94373'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("UPDATE tenants SET slug = 'yippie' WHERE slug = 'default'")


def downgrade() -> None:
    op.execute("UPDATE tenants SET slug = 'default' WHERE slug = 'yippie'")
