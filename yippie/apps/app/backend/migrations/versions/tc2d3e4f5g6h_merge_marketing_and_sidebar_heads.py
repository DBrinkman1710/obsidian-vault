"""merge marketing and sidebar heads — folds in sidebar_order column

Revision ID: tc2d3e4f5g6h
Revises: em1k2t3g4h5j
Create Date: 2026-06-21

sb1a2b3c4d5e (add_sidebar_order_to_users) was created but never applied to
the sandbox DB before this merge migration was written. Its sole DDL change
(adding users.sidebar_order) is folded in here so the column lands correctly.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB
from alembic import op

revision: str = 'tc2d3e4f5g6h'
down_revision: Union[str, Sequence[str], None] = 'em1k2t3g4h5j'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column('sidebar_order', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'sidebar_order')
