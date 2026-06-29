"""Backfill 'ai' into enabled_modules for all existing tenants.

Revision ID: ai1_enable_module
Revises: c1a2b3d4e5f6
Create Date: 2026-06-29

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'ai1_enable_module'
down_revision: Union[str, None] = 'c1a2b3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        UPDATE tenants
        SET enabled_modules = array_append(enabled_modules, 'ai')
        WHERE NOT ('ai' = ANY(enabled_modules))
    """)


def downgrade() -> None:
    op.execute("""
        UPDATE tenants
        SET enabled_modules = array_remove(enabled_modules, 'ai')
    """)
