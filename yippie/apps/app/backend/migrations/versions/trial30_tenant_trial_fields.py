"""[TRIAL30] tenants.trial_ends_at + trial nudge markers — 30 day free trial on signup

Revision ID: trial30_trial_fields
Revises: 85f2fad0a594
Create Date: 2026-07-08
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'trial30_trial_fields'
down_revision: Union[str, None] = '85f2fad0a594'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # When set, the tenant is on a free trial; the hourly trial_expiry_check job
    # deactivates it after this time unless a Stripe subscription became active.
    op.add_column('tenants', sa.Column('trial_ends_at', sa.DateTime(timezone=True), nullable=True))
    # Day 23 reciprocity nudge + day 28 loss aversion nudge dedup markers.
    op.add_column('tenants', sa.Column('trial_nudge_sent_at', sa.DateTime(timezone=True), nullable=True))
    op.add_column('tenants', sa.Column('trial_final_nudge_sent_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'trial_final_nudge_sent_at')
    op.drop_column('tenants', 'trial_nudge_sent_at')
    op.drop_column('tenants', 'trial_ends_at')
