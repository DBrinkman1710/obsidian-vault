"""add lead widget config to tenant

Revision ID: a1b2c3d4e5f0
Revises: z9a0b1c2d3e4
Create Date: 2026-06-23 00:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f0'
down_revision: Union[str, Sequence[str], None] = 'z9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('tenants', sa.Column('lead_widget_save_contact', sa.Boolean(), nullable=False, server_default='true'))
    op.add_column('tenants', sa.Column('lead_widget_stage_id', postgresql.UUID(as_uuid=True), nullable=True))


def downgrade() -> None:
    op.drop_column('tenants', 'lead_widget_stage_id')
    op.drop_column('tenants', 'lead_widget_save_contact')
