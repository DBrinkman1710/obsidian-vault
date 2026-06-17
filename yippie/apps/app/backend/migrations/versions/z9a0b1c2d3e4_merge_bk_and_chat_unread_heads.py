"""merge bk chain and chat unread heads

Revision ID: z9a0b1c2d3e4
Revises: d2e3f4a5b6c7, y1z2a3b4c5d6
Create Date: 2026-06-16

"""
from typing import Sequence, Union

revision: str = 'z9a0b1c2d3e4'
down_revision: Union[str, Sequence[str], None] = ('d2e3f4a5b6c7', 'y1z2a3b4c5d6')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
