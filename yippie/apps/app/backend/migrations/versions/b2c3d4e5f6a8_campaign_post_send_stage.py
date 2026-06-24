"""add post_send_stage_id to campaigns for automatic stage move at dispatch time

Revision ID: b2c3d4e5f6a8
Revises: e6460a87b052
Create Date: 2026-06-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID as PG_UUID

revision: str = 'b2c3d4e5f6a8'
down_revision: Union[str, Sequence[str], None] = 'e6460a87b052'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'campaigns',
        sa.Column('post_send_stage_id', PG_UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        'fk_campaigns_post_send_stage_id',
        'campaigns', 'pipeline_stages',
        ['post_send_stage_id'], ['id'],
        ondelete='SET NULL',
    )


def downgrade() -> None:
    op.drop_constraint('fk_campaigns_post_send_stage_id', 'campaigns', type_='foreignkey')
    op.drop_column('campaigns', 'post_send_stage_id')
