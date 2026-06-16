"""BK5 — add weekly_slots and use_weekly_slots to calendar_settings

Revision ID: z6a7b8c9d0e1
Revises: y5z6a7b8c9d0
Create Date: 2026-06-16

Adds two columns to support the smart weekly-schedule booking model:
  - weekly_slots  JSONB  nullable — keyed "0"–"6" (Mon–Sun), each value an
                                    array of {time: HH:MM, capacity: N} objects
  - use_weekly_slots  BOOLEAN NOT NULL DEFAULT false — feature toggle
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = 'z6a7b8c9d0e1'
down_revision: Union[str, None] = 'y5z6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'calendar_settings',
        sa.Column('weekly_slots', JSONB(), nullable=True),
    )
    op.add_column(
        'calendar_settings',
        sa.Column(
            'use_weekly_slots',
            sa.Boolean(),
            nullable=False,
            server_default=sa.text('false'),
        ),
    )


def downgrade() -> None:
    op.drop_column('calendar_settings', 'use_weekly_slots')
    op.drop_column('calendar_settings', 'weekly_slots')
