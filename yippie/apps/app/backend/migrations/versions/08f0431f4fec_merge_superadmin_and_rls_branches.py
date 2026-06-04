"""merge superadmin and rls branches

Revision ID: 08f0431f4fec
Revises: c3d4e5f6a7b8, f2e3d4c5b6a7
Create Date: 2026-06-04 08:34:31.628280

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = '08f0431f4fec'
down_revision: Union[str, None] = ('c3d4e5f6a7b8', 'f2e3d4c5b6a7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
