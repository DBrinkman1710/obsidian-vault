"""wk2 — booking token scope (shared vs personal availability)

Revision ID: wk2_booking_token_scope
Revises: wk1_calendar_availability_exceptions
Create Date: 2026-09-17

A booking link can now be scoped to one user's personal availability. scope
defaults to 'shared' so every existing and future shared link is unchanged;
'personal' links surface only the sender's (created_by) availability and book
against the sender's own calendar.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "wk2_booking_token_scope"
down_revision: Union[str, None] = "wk1_calendar_availability_exceptions"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE booking_tokens "
        "ADD COLUMN IF NOT EXISTS scope VARCHAR(20) NOT NULL DEFAULT 'shared'"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE booking_tokens DROP COLUMN IF EXISTS scope")
