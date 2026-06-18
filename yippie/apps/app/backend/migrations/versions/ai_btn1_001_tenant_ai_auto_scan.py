"""AI-BTN1: add ai_auto_scan toggle to tenants (default off = explicit Generate)

Revision ID: ai_btn1_001
Revises: a0b1c2d3e4f5
Create Date: 2026-06-18

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'ai_btn1_001'
down_revision: Union[str, None] = 'a0b1c2d3e4f5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # When False (default) the inbox AI never auto-runs — agents click Generate
    # per draft. True restores the old auto-scan-on-arrival behaviour.
    op.add_column(
        'tenants',
        sa.Column('ai_auto_scan', sa.Boolean(), nullable=False, server_default='false'),
    )


def downgrade() -> None:
    op.drop_column('tenants', 'ai_auto_scan')
