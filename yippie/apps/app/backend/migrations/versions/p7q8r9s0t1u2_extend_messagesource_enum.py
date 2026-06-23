"""extend messagesource enum with manual chat portal values

Revision ID: p7q8r9s0t1u2
Revises: ob1c2d3e4f5g
Create Date: 2026-06-23 10:00:00.000000

The initial schema migration created the messagesource PostgreSQL enum via the
inbound_messages table (email + whatsapp only). The tickets and ticket_comments
tables reference the same named type but with additional values (manual, chat,
portal). Because the type already existed when those tables were created,
PostgreSQL never added the extra values — making any INSERT with source='manual'
fail.  This migration adds the missing values so comments and manually-created
tickets can be saved.
"""
from typing import Sequence, Union
from alembic import op


revision: str = 'p7q8r9s0t1u2'
down_revision: Union[str, None] = 'ob1c2d3e4f5g'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE messagesource ADD VALUE IF NOT EXISTS 'manual'")
    op.execute("ALTER TYPE messagesource ADD VALUE IF NOT EXISTS 'chat'")
    op.execute("ALTER TYPE messagesource ADD VALUE IF NOT EXISTS 'portal'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values without recreating the type.
    pass
