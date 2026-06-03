"""add superadmin role

Revision ID: e1f2a3b4c5d6
Revises: 40bd1ebcda20
Create Date: 2026-06-03

"""
from typing import Sequence, Union
from alembic import op

revision: str = 'e1f2a3b4c5d6'
down_revision: Union[str, None] = '40bd1ebcda20'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'superadmin'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values
    pass
