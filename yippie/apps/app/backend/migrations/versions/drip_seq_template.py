"""add design_json + campaign_buttons to campaign_sequences (drip visual templates)

Revision ID: drip_seq_template
Revises: wk2_booking_token_scope
Create Date: 2026-09-23

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'drip_seq_template'
down_revision: Union[str, None] = 'wk2_booking_token_scope'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('campaign_sequences', sa.Column('design_json', sa.Text(), nullable=True))
    op.add_column('campaign_sequences', sa.Column('campaign_buttons', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('campaign_sequences', 'campaign_buttons')
    op.drop_column('campaign_sequences', 'design_json')
