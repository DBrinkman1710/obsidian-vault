"""draft_tickets.opened_by — who first opened the draft, for time to open metric

Revision ID: act2_draft_opened_by
Revises: signup_needs_password
Create Date: 2026-07-13

[ACTIVITY2] Users tab. draft_tickets already carries opened_at (stamped on
first open in the inbox); this records WHO opened it so avg time to open
(opened_at - inbound.received_at) can be attributed per user + rolled up for
the shared inbox. Idempotent ADD COLUMN IF NOT EXISTS for sandbox schema drift.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'act2_draft_opened_by'
down_revision: Union[str, Sequence[str], None] = 'signup_needs_password'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE draft_tickets ADD COLUMN IF NOT EXISTS opened_by UUID REFERENCES users(id)"
    )


def downgrade() -> None:
    op.drop_column('draft_tickets', 'opened_by')
