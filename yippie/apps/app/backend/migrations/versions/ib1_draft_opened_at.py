"""add opened_at to draft_tickets

Revision ID: ib1_draft_opened_at
Revises: ae54982f47a2
Create Date: 2026-06-22

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

revision: str = 'ib1_draft_opened_at'
down_revision: Union[str, None] = 'ae54982f47a2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('draft_tickets', sa.Column('opened_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    op.drop_column('draft_tickets', 'opened_at')
