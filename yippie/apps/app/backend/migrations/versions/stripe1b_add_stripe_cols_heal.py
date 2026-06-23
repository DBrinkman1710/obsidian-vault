"""stripe1b: add stripe columns to tenants (heal — stripe1 was skipped)

The CAL-SPLIT deploy had already stamped bbb0a57399ce into the DB before
stripe1_tenant_stripe_cols was introduced, so alembic skipped that migration.
This migration applies the same DDL using IF NOT EXISTS so it is idempotent.

Revision ID: stripe1b_add_stripe_cols_heal
Revises: bbb0a57399ce
Create Date: 2026-06-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'stripe1b_add_stripe_cols_heal'
down_revision: Union[str, None] = 'bbb0a57399ce'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_customer_id VARCHAR(100)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_id VARCHAR(100)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_subscription_status VARCHAR(50)")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS stripe_price_ids JSONB")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_scans_used_this_period INTEGER NOT NULL DEFAULT 0")
    op.execute("ALTER TABLE tenants ADD COLUMN IF NOT EXISTS ai_scans_period_start TIMESTAMPTZ")


def downgrade() -> None:
    op.drop_column('tenants', 'ai_scans_period_start')
    op.drop_column('tenants', 'ai_scans_used_this_period')
    op.drop_column('tenants', 'stripe_price_ids')
    op.drop_column('tenants', 'stripe_subscription_status')
    op.drop_column('tenants', 'stripe_subscription_id')
    op.drop_column('tenants', 'stripe_customer_id')
