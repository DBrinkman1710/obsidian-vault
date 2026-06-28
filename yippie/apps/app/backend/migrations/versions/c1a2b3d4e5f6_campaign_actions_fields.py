"""Add reply_received_stage_id, button_stage_config, linked_stage_id to campaigns.

z9a0b1c2d3e4 is already an ancestor of d7e8f9a0b1c2, so this is a linear migration.

Revision ID: c1a2b3d4e5f6
Revises: d7e8f9a0b1c2
Create Date: 2026-06-27

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID as PG_UUID

revision: str = 'c1a2b3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'd7e8f9a0b1c2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'campaigns',
        sa.Column('reply_received_stage_id', PG_UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_campaigns_reply_received_stage_id',
        'campaigns', 'pipeline_stages',
        ['reply_received_stage_id'], ['id'],
        ondelete='SET NULL',
    )

    op.add_column(
        'campaigns',
        sa.Column('button_stage_config', JSONB, nullable=True),
    )

    op.add_column(
        'campaigns',
        sa.Column('linked_stage_id', PG_UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_campaigns_linked_stage_id',
        'campaigns', 'pipeline_stages',
        ['linked_stage_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_campaigns_linked_stage_id', 'campaigns', type_='foreignkey')
    op.drop_column('campaigns', 'linked_stage_id')
    op.drop_column('campaigns', 'button_stage_config')
    op.drop_constraint('fk_campaigns_reply_received_stage_id', 'campaigns', type_='foreignkey')
    op.drop_column('campaigns', 'reply_received_stage_id')
