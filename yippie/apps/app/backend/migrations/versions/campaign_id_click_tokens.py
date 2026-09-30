"""add campaign_id to label_click_tokens (per campaign button analytics)

Revision ID: campaign_id_click_tokens
Revises: drip_seq_template
Create Date: 2026-09-30

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = 'campaign_id_click_tokens'
down_revision: Union[str, None] = 'drip_seq_template'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'label_click_tokens',
        sa.Column('campaign_id', PG_UUID(as_uuid=True), nullable=True),
    )
    op.create_index(
        'ix_label_click_tokens_campaign_id',
        'label_click_tokens',
        ['campaign_id'],
    )
    op.create_foreign_key(
        'fk_label_click_tokens_campaign_id',
        'label_click_tokens',
        'campaigns',
        ['campaign_id'],
        ['id'],
        ondelete='CASCADE',
    )


def downgrade() -> None:
    op.drop_constraint('fk_label_click_tokens_campaign_id', 'label_click_tokens', type_='foreignkey')
    op.drop_index('ix_label_click_tokens_campaign_id', table_name='label_click_tokens')
    op.drop_column('label_click_tokens', 'campaign_id')
