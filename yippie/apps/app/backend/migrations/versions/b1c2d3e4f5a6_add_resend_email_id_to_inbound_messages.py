"""add resend_email_id to inbound_messages

Revision ID: b1c2d3e4f5a6
Revises: a9b8c7d6e5f4
Create Date: 2026-06-05

"""
from typing import Sequence, Union
import sqlalchemy as sa
from alembic import op


revision: str = 'b1c2d3e4f5a6'
down_revision: Union[str, None] = 'a9b8c7d6e5f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('inbound_messages', sa.Column('resend_email_id', sa.String(100), nullable=True))
    op.create_index('ix_inbound_messages_resend_email_id', 'inbound_messages', ['resend_email_id'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_inbound_messages_resend_email_id', table_name='inbound_messages')
    op.drop_column('inbound_messages', 'resend_email_id')
