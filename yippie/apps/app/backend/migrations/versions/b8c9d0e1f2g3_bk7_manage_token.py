"""BK7 — add manage_token to booking_tokens and cancel_edit_hours_before to calendar_settings

Revision ID: b8c9d0e1f2g3
Revises: 478e0aa6c080
Create Date: 2026-06-16

Adds:
  - booking_tokens.manage_token  UUID  nullable unique — generated at confirm time,
                                                         used as the customer self-serve manage link token
  - calendar_settings.cancel_edit_hours_before  INTEGER NOT NULL DEFAULT 24 — lock window in hours
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'b8c9d0e1f2g3'
down_revision: Union[str, None] = '478e0aa6c080'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'booking_tokens',
        sa.Column('manage_token', UUID(as_uuid=True), nullable=True),
    )
    op.create_unique_constraint(
        'uq_booking_tokens_manage_token',
        'booking_tokens',
        ['manage_token'],
    )
    op.add_column(
        'calendar_settings',
        sa.Column(
            'cancel_edit_hours_before',
            sa.Integer(),
            nullable=False,
            server_default='24',
        ),
    )


def downgrade() -> None:
    op.drop_column('calendar_settings', 'cancel_edit_hours_before')
    op.drop_constraint('uq_booking_tokens_manage_token', 'booking_tokens', type_='unique')
    op.drop_column('booking_tokens', 'manage_token')
