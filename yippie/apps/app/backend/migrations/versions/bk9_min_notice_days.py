"""add min_notice_days to calendar_settings

Revision ID: bk9_min_notice_days
Revises: m1_merge_prod_and_calendar
Create Date: 2026-07-03

"""
from alembic import op
import sqlalchemy as sa

revision: str = 'bk9_min_notice_days'
down_revision = 'm1_merge_prod_and_calendar'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'calendar_settings',
        sa.Column('min_notice_days', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('calendar_settings', 'min_notice_days')
