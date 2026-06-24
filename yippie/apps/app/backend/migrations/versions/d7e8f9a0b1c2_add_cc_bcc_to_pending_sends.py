"""add cc_emails and bcc_emails to pending_sends

Revision ID: d7e8f9a0b1c2
Revises: b2c3d4e5f6a8
Create Date: 2026-06-24

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'd7e8f9a0b1c2'
down_revision: Union[str, Sequence[str], None] = 'b2c3d4e5f6a8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('pending_sends', sa.Column('cc_emails', sa.Text(), nullable=True))
    op.add_column('pending_sends', sa.Column('bcc_emails', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('pending_sends', 'bcc_emails')
    op.drop_column('pending_sends', 'cc_emails')
