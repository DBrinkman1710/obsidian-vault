"""remove aitools from enabled_modules (renamed to ai in session 11)

Revision ID: f5a6b7c8d9e0
Revises: e4f5a6b7c8d9
Create Date: 2026-06-05

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'f5a6b7c8d9e0'
down_revision: Union[str, None] = 'e4f5a6b7c8d9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "UPDATE tenants SET enabled_modules = array_remove(enabled_modules, 'aitools') "
        "WHERE 'aitools' = ANY(enabled_modules)"
    )


def downgrade() -> None:
    pass
