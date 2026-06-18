"""merge ai_btn1 and billing2/session_dedup heads

Revision ID: c2d3e4f5a6b7
Revises: b1c2d3e4f5g6, ai_btn1_001
Create Date: 2026-06-18

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'c2d3e4f5a6b7'
down_revision: Union[str, None] = ('b1c2d3e4f5g6', 'ai_btn1_001')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
