"""BK5 — add weekly_slots and use_weekly_slots to calendar_settings

Revision ID: z6a7b8c9d0e1
Revises: x4y5z6a7b8c9
Create Date: 2026-06-16

Adds two columns to support the smart weekly-schedule booking model:
  - weekly_slots  JSONB  nullable — keyed "0"–"6" (Mon–Sun), each value an
                                    array of {time: HH:MM, capacity: N} objects
  - use_weekly_slots  BOOLEAN NOT NULL DEFAULT false — feature toggle

Now chained off x4y5z6a7b8c9 (rename_plans merge) so the soft-delete
migration w3x4y5z6a7b8 is always applied before this runs.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text
from sqlalchemy.dialects.postgresql import JSONB

revision: str = 'z6a7b8c9d0e1'
down_revision: Union[str, None] = 'x4y5z6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _has_column(table: str, column: str) -> bool:
    conn = op.get_bind()
    return bool(conn.execute(
        text("SELECT 1 FROM information_schema.columns WHERE table_name=:t AND column_name=:c"),
        {"t": table, "c": column},
    ).scalar())


def upgrade() -> None:
    if not _has_column('calendar_settings', 'weekly_slots'):
        op.add_column('calendar_settings', sa.Column('weekly_slots', JSONB(), nullable=True))
    if not _has_column('calendar_settings', 'use_weekly_slots'):
        op.add_column(
            'calendar_settings',
            sa.Column('use_weekly_slots', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        )


def downgrade() -> None:
    op.drop_column('calendar_settings', 'use_weekly_slots')
    op.drop_column('calendar_settings', 'weekly_slots')
