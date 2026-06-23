"""stripe platform — add stripe columns to tenants

Revision ID: stripe1_tenant_stripe_cols
Revises: 7aaecb9a1dbb
Create Date: 2026-06-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'stripe1_tenant_stripe_cols'
down_revision: Union[str, None] = '7aaecb9a1dbb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('stripe_customer_id', sa.String(100), nullable=True))
    op.add_column('tenants', sa.Column('stripe_subscription_id', sa.String(100), nullable=True))
    op.add_column('tenants', sa.Column('stripe_subscription_status', sa.String(50), nullable=True))
    op.add_column('tenants', sa.Column('stripe_price_ids', postgresql.JSONB(), nullable=True))
    op.add_column('tenants', sa.Column('ai_scans_used_this_period', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('tenants', sa.Column('ai_scans_period_start', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'ai_scans_period_start')
    op.drop_column('tenants', 'ai_scans_used_this_period')
    op.drop_column('tenants', 'stripe_price_ids')
    op.drop_column('tenants', 'stripe_subscription_status')
    op.drop_column('tenants', 'stripe_subscription_id')
    op.drop_column('tenants', 'stripe_customer_id')
