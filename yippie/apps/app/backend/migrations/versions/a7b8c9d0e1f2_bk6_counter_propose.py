"""BK6 — add customer_proposed_slots and status_override to booking_tokens

Revision ID: 478e0aa6c080
Revises: z6a7b8c9d0e1
Create Date: 2026-06-16

Adds two columns to support customer counter-proposing meeting times:
  - customer_proposed_slots  JSONB  nullable — list of {start, end} ISO strings
  - status_override  VARCHAR(20)  nullable — stores 'counter_proposed' when set;
                                             uses a plain varchar rather than altering
                                             the status enum to avoid a multi-step
                                             ALTER TYPE migration.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision: str = '478e0aa6c080'
down_revision: Union[str, None] = 'z6a7b8c9d0e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'booking_tokens',
        sa.Column('customer_proposed_slots', JSONB(), nullable=True),
    )
    op.add_column(
        'booking_tokens',
        sa.Column('status_override', sa.String(20), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('booking_tokens', 'status_override')
    op.drop_column('booking_tokens', 'customer_proposed_slots')
