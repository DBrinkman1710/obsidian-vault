"""merge marketing and sidebar heads

Revision ID: tc2d3e4f5g6h
Revises: em1k2t3g4h5j, sb1a2b3c4d5e
Create Date: 2026-06-21

"""
from typing import Sequence, Union

revision: str = 'tc2d3e4f5g6h'
down_revision: Union[str, Sequence[str], None] = ('em1k2t3g4h5j', 'sb1a2b3c4d5e')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
