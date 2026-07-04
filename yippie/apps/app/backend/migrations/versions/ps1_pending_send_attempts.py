"""add attempts to pending_sends for retry-safe dispatch

Revision ID: ps1_pending_send_attempts
Revises: bk9_min_notice_days
Create Date: 2026-07-04

"""
from alembic import op
import sqlalchemy as sa

revision: str = 'ps1_pending_send_attempts'
down_revision = 'bk9_min_notice_days'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        'pending_sends',
        sa.Column('attempts', sa.Integer(), nullable=False, server_default='0'),
    )


def downgrade() -> None:
    op.drop_column('pending_sends', 'attempts')
