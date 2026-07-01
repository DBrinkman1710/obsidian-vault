"""add calendar_event_invitations table

Revision ID: h3i4j5k6l7m8
Revises: g2h3i4j5k6l7
Create Date: 2026-07-01

User-to-user event invitations within a tenant.
Invitees can accept, decline, or propose an alternative time.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'h3i4j5k6l7m8'
down_revision: Union[str, None] = 'g2h3i4j5k6l7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'calendar_event_invitations',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column(
            'event_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('calendar_events.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column(
            'invitee_id', postgresql.UUID(as_uuid=True),
            sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False,
        ),
        sa.Column('status', sa.String(20), nullable=False, server_default='proposed'),
        sa.Column('counter_proposed_slots', postgresql.JSONB(), nullable=True),
        sa.Column('message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index('ix_cal_inv_tenant_id', 'calendar_event_invitations', ['tenant_id'])
    op.create_index('ix_cal_inv_event_id', 'calendar_event_invitations', ['event_id'])
    op.create_index('ix_cal_inv_invitee_id', 'calendar_event_invitations', ['invitee_id'])
    op.create_unique_constraint(
        'uq_cal_inv_event_invitee',
        'calendar_event_invitations',
        ['event_id', 'invitee_id'],
    )


def downgrade() -> None:
    op.drop_table('calendar_event_invitations')
