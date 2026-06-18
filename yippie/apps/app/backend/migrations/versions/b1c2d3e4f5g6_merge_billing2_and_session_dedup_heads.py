"""merge billing2 and session_dedup heads

Revision ID: b1c2d3e4f5g6
Revises: a0b1c2d3e4f5, a0b1c2d3e4f6
Create Date: 2026-06-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'b1c2d3e4f5g6'
down_revision: Union[str, None] = ('a0b1c2d3e4f5', 'a0b1c2d3e4f6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
