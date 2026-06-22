"""add timezone to calendar_settings

Revision ID: bk_tz_calendar_settings
Revises: ib1_draft_opened_at
Create Date: 2026-06-22

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'bk_tz_calendar_settings'
down_revision: Union[str, None] = 'ib1_draft_opened_at'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'calendar_settings',
        sa.Column(
            'timezone',
            sa.String(length=64),
            nullable=False,
            server_default='Europe/Amsterdam',
        ),
    )


def downgrade() -> None:
    op.drop_column('calendar_settings', 'timezone')
