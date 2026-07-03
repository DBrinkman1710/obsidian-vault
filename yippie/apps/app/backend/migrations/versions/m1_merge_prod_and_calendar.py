"""merge production pipeline index and calendar sync heads

Revision ID: m1_merge_prod_and_calendar
Revises: 3c4d5e6f7a8b, a1b2_pipeline_board_index
Create Date: 2026-07-03

"""
from __future__ import annotations

from typing import Sequence, Union

revision: str = 'm1_merge_prod_and_calendar'
down_revision: Union[str, Sequence[str], None] = ('3c4d5e6f7a8b', 'a1b2_pipeline_board_index')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
