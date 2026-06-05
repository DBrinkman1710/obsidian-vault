"""add is_active to users and aitools module to tenants

Revision ID: d3e4f5a6b7c8
Revises: b1c2d3e4f5a6
Create Date: 2026-06-05

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op


revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'b1c2d3e4f5a6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add is_active to users — IF NOT EXISTS so this is safe to re-run
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
        "is_active BOOLEAN NOT NULL DEFAULT TRUE"
    )
    # Backfill aitools into all existing tenants
    op.execute(
        "UPDATE tenants SET enabled_modules = array_append(enabled_modules, 'aitools') "
        "WHERE NOT ('aitools' = ANY(enabled_modules))"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE tenants SET enabled_modules = array_remove(enabled_modules, 'aitools')"
    )
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS is_active")
