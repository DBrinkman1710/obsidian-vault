"""Add setup_checklist_dismissed to users and onboarding_drip_sent to tenants.

Revision ID: ob1c2d3e4f5g
Revises: bk8_booking_token_stage_override
Create Date: 2026-06-22

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'ob1c2d3e4f5g'
down_revision: Union[str, None] = 'bk8_booking_token_stage_override'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'setup_checklist_dismissed',
        sa.Boolean(),
        nullable=False,
        server_default='false',
    ))
    op.add_column('tenants', sa.Column(
        'onboarding_drip_sent',
        postgresql.JSONB(astext_type=sa.Text()),
        nullable=True,
        server_default='[]',
    ))


def downgrade() -> None:
    op.drop_column('users', 'setup_checklist_dismissed')
    op.drop_column('tenants', 'onboarding_drip_sent')
