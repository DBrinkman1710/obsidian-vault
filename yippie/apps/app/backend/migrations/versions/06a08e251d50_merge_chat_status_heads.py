"""merge chat message status and billing2 heads

Revision ID: 06a08e251d50
Revises: c2d3e4f5a6b7, ec14fd002380
Create Date: 2026-06-18
"""
from __future__ import annotations
from typing import Sequence, Union
from alembic import op

revision: str = '06a08e251d50'
down_revision: Union[str, Sequence[str], None] = ('c2d3e4f5a6b7', 'ec14fd002380')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
