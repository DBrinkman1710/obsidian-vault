"""contact soft delete

Revision ID: w3x4y5z6a7b8
Revises: v2w3x4y5z6a7
Create Date: 2026-06-15

"""
from alembic import op
import sqlalchemy as sa

revision = 'w3x4y5z6a7b8'
down_revision = 'v2w3x4y5z6a7'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('contacts', sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('contacts', 'deleted_at')
