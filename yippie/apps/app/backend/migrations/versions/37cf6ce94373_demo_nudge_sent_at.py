"""Add demo_nudge_sent_at to tenants

Revision ID: a1b2c3d4e5f6
Revises: 207c10c02c3e
Create Date: 2026-06-23

Adds demo_nudge_sent_at (nullable datetime) to tenants so the day-3 nudge job
can track which demo tenants have already received the check-in email.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '37cf6ce94373'
down_revision: Union[str, None] = '207c10c02c3e'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'tenants',
        sa.Column('demo_nudge_sent_at', sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'demo_nudge_sent_at')
