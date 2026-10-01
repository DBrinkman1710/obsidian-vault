"""add campaigns.enable_ab

Launch now was made asynchronous (the request queues the campaign and the
marketing scheduler dispatches it off-request with rate-limit-safe pacing).
The scheduler re-reads the campaign row at send time, so the user's A/B choice
has to be persisted rather than passed in-process. Defaults to true to preserve
the previous always-A/B-when-two-variants behaviour.

Revision ID: add_campaign_enable_ab
Revises: backfill_button_clicked_status
Create Date: 2026-10-01

"""
from __future__ import annotations

from typing import Sequence, Union

from alembic import op

revision: str = 'add_campaign_enable_ab'
down_revision: Union[str, None] = 'backfill_button_clicked_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent: the Sandbox DB has drifted ahead of alembic_version before, so
    # guard against the column already existing.
    op.execute(
        "ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS enable_ab "
        "BOOLEAN NOT NULL DEFAULT true"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE campaigns DROP COLUMN IF EXISTS enable_ab")
