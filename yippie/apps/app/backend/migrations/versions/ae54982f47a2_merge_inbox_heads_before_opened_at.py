"""merge_inbox_heads_before_opened_at

Revision ID: ae54982f47a2
Revises: bk8w_booking_window_days, p2q3r4s5t6u7
Create Date: 2026-06-22 11:12:33.823839

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'ae54982f47a2'
down_revision: Union[str, None] = ('bk8w_booking_window_days', 'p2q3r4s5t6u7')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
