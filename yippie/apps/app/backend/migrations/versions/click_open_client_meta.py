"""add client metadata (ip, user agent, bot) to click and open tracking

Revision ID: click_open_client_meta
Revises: add_campaign_enable_ab
Create Date: 2026-10-02

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'click_open_client_meta'
down_revision: Union[str, Sequence[str], None] = 'add_campaign_enable_ab'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'label_click_tokens',
        sa.Column('click_ip', sa.String(64), nullable=True),
    )
    op.add_column(
        'label_click_tokens',
        sa.Column('click_user_agent', sa.String(512), nullable=True),
    )
    op.add_column(
        'label_click_tokens',
        sa.Column('click_is_bot', sa.Boolean(), nullable=False, server_default=sa.text('false')),
    )
    op.add_column(
        'campaign_analytics',
        sa.Column('open_ip', sa.String(64), nullable=True),
    )
    op.add_column(
        'campaign_analytics',
        sa.Column('open_user_agent', sa.String(512), nullable=True),
    )
    op.add_column(
        'campaign_analytics',
        sa.Column('open_is_bot', sa.Boolean(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('campaign_analytics', 'open_is_bot')
    op.drop_column('campaign_analytics', 'open_user_agent')
    op.drop_column('campaign_analytics', 'open_ip')
    op.drop_column('label_click_tokens', 'click_is_bot')
    op.drop_column('label_click_tokens', 'click_user_agent')
    op.drop_column('label_click_tokens', 'click_ip')
