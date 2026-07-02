"""merge open heads + add help_tips_enabled to users

Revision ID: help1
Revises: a1b2c3d4e5f6, t4u5v6w7x8y9, z9a0b1c2d3e4
Create Date: 2026-07-02

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'help1'
down_revision: Union[str, Sequence[str], None] = ('a1b2c3d4e5f6', 't4u5v6w7x8y9', 'z9a0b1c2d3e4')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'help_tips_enabled',
        sa.Boolean(),
        nullable=False,
        server_default='true',
    ))


def downgrade() -> None:
    op.drop_column('users', 'help_tips_enabled')
