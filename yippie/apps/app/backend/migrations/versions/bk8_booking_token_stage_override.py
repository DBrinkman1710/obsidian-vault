"""add stage_id_override to booking_tokens (BK8)

Revision ID: bk8_booking_token_stage_override
Revises: bk_tz_calendar_settings
Create Date: 2026-06-22

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'bk8_booking_token_stage_override'
down_revision: Union[str, None] = 'bk_tz_calendar_settings'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'booking_tokens',
        sa.Column(
            'stage_id_override',
            UUID(as_uuid=True),
            nullable=True,
        ),
    )
    op.create_foreign_key(
        'fk_booking_tokens_stage_id_override',
        'booking_tokens',
        'pipeline_stages',
        ['stage_id_override'],
        ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_booking_tokens_stage_id_override', 'booking_tokens', type_='foreignkey')
    op.drop_column('booking_tokens', 'stage_id_override')
