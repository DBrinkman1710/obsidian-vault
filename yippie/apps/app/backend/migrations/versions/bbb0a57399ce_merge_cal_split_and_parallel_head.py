"""merge_cal_split_and_parallel_head

Revision ID: bbb0a57399ce
Revises: 4a2953a4d504, cal_split_cal_type_from_email
Create Date: 2026-06-23 09:45:21.794867

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa


revision: str = 'bbb0a57399ce'
down_revision: Union[str, None] = ('4a2953a4d504', 'cal_split_cal_type_from_email')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
