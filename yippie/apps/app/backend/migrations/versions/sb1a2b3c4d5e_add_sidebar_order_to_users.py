"""add sidebar_order to users

Revision ID: sb1a2b3c4d5e
Revises: z9a0b1c2d3e4
Create Date: 2026-06-21

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'sb1a2b3c4d5e'
down_revision = 'z9a0b1c2d3e4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column('sidebar_order', JSONB, nullable=True))


def downgrade() -> None:
    op.drop_column('users', 'sidebar_order')
