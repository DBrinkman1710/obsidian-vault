"""Add order stage mapping columns to tenants

Revision ID: s3t4u5v6w7x8
Revises: r2s3t4u5v6w7
Create Date: 2026-07-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 's3t4u5v6w7x8'
down_revision: Union[str, Sequence[str], None] = 'r2s3t4u5v6w7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('order_placed_stage_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('tenants', sa.Column('order_shipped_stage_id', postgresql.UUID(as_uuid=True), nullable=True))
    op.add_column('tenants', sa.Column('order_delivered_stage_id', postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'order_delivered_stage_id')
    op.drop_column('tenants', 'order_shipped_stage_id')
    op.drop_column('tenants', 'order_placed_stage_id')
