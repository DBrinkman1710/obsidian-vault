"""booking_window_days on calendar_settings

Adds a configurable booking lookahead window (default 60 days), distinct from
booking_expiry_days (invite-link validity). Fixes public booking pages running
out of slots after ~2 weeks. Also merges the two open migration heads.

Revision ID: bk8w_booking_window_days
Revises: a3b4c5d6e7f8, n4o5p6q7r8s9
Create Date: 2026-06-22 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'bk8w_booking_window_days'
down_revision: Union[str, Sequence[str], None] = ('a3b4c5d6e7f8', 'n4o5p6q7r8s9')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'calendar_settings',
        sa.Column(
            'booking_window_days',
            sa.Integer(),
            nullable=False,
            server_default='60',
        ),
    )


def downgrade() -> None:
    op.drop_column('calendar_settings', 'booking_window_days')
