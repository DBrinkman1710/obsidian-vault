"""add subscription_ends_at to tenants

Revision ID: a1b2c3d4e5f7
Revises: z9a0b1c2d3e4
Create Date: 2026-07-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2c3d4e5f7'
down_revision: Union[str, Sequence[str], None] = 'z9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('subscription_ends_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'subscription_ends_at')
