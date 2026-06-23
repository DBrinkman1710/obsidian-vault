"""cal_split: calendar_type on events + from_email on booking_tokens

Revision ID: cal_split_cal_type_from_email
Revises: 7aaecb9a1dbb
Create Date: 2026-06-23

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'cal_split_cal_type_from_email'
down_revision: Union[str, Sequence[str], None] = '7aaecb9a1dbb'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'calendar_events',
        sa.Column('calendar_type', sa.String(10), nullable=False, server_default='shared'),
    )
    op.add_column(
        'booking_tokens',
        sa.Column('from_email', sa.String(255), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('booking_tokens', 'from_email')
    op.drop_column('calendar_events', 'calendar_type')
