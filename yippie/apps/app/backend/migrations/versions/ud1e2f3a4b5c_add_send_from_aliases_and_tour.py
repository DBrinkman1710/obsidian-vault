"""add send_from_aliases and tour_completed to users

Revision ID: ud1e2f3a4b5c
Revises: tc2d3e4f5g6h
Create Date: 2026-06-21
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from alembic import op

revision: str = 'ud1e2f3a4b5c'
down_revision: Union[str, Sequence[str], None] = 'tc2d3e4f5g6h'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('send_from_aliases', JSONB, nullable=True))
    op.add_column('users', sa.Column('tour_completed', sa.Boolean(), nullable=False, server_default='false'))


def downgrade() -> None:
    op.drop_column('users', 'tour_completed')
    op.drop_column('users', 'send_from_aliases')
