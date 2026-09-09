"""stripe_webhook_events — idempotency ledger for Stripe platform webhooks

Revision ID: acclock2_stripe_webhook_events
Revises: acclock1_access_locked_at
Create Date: 2026-09-09

Stripe may deliver the same event more than once (at-least-once delivery, plus
retries on any 5xx). Most handlers are naturally idempotent, but invoice.paid
resets ai_scans_used_this_period, so a duplicate delivery silently wipes accrued
usage. This table records each processed event id so the webhook can skip
duplicates. Global (not tenant scoped) — the webhook runs before any tenant
context is set, so no RLS.

Written defensively (IF NOT EXISTS) because this DB has known schema drift — a
partially applied or re-run deploy must never abort.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "acclock2_stripe_webhook_events"
down_revision: Union[str, Sequence[str], None] = "acclock1_access_locked_at"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS stripe_webhook_events (
            event_id    VARCHAR PRIMARY KEY,
            event_type  VARCHAR,
            received_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS stripe_webhook_events")
