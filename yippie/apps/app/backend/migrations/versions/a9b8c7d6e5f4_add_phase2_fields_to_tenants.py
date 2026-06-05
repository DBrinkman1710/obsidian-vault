"""add phase2 fields to tenants (is_active, is_demo, go_live_at, inbound_email)

Revision ID: a9b8c7d6e5f4
Revises: 08f0431f4fec
Create Date: 2026-06-05

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op


revision: str = 'a9b8c7d6e5f4'
down_revision: Union[str, None] = '08f0431f4fec'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column('tenants', sa.Column('is_demo', sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column('tenants', sa.Column('go_live_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('tenants', sa.Column('inbound_email', sa.String(255), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'inbound_email')
    op.drop_column('tenants', 'go_live_at')
    op.drop_column('tenants', 'is_demo')
    op.drop_column('tenants', 'is_active')
