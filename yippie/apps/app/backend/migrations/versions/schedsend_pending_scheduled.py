"""pending_sends.scheduled — flag genuine "send later" rows

Revision ID: schedsend_pending_scheduled
Revises: acclock2_stripe_webhook_events
Create Date: 2026-09-09

A queued send normally has send_at = now + 8s (the undo window). A "send later"
send sets send_at to a user chosen future time. Both are attempts == 0 rows with
send_at > now, so they are otherwise indistinguishable. This boolean marks the
user scheduled rows so the Scheduled list can show them without also listing the
transient undo window rows.

Written defensively (IF NOT EXISTS) because this DB has known schema drift — a
partially applied or re-run deploy must never abort.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "schedsend_pending_scheduled"
down_revision: Union[str, Sequence[str], None] = "acclock2_stripe_webhook_events"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE pending_sends "
        "ADD COLUMN IF NOT EXISTS scheduled BOOLEAN NOT NULL DEFAULT false"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE pending_sends DROP COLUMN IF EXISTS scheduled")
