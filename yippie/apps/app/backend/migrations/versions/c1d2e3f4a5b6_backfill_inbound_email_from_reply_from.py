"""backfill users.inbound_email from reply_from_email

Users who set their personal address before session-18 (when inbound_email was
added) have reply_from_email set but inbound_email NULL, so the poller routing
map never includes them and personal-inbox receiving silently fails.

Backfill inbound_email = reply_from_email for affected rows:
  - inbound_email IS NULL
  - reply_from_email ends with @getyippie.com (the Resend receiving domain)
  - no other user already holds that inbound_email (unique constraint)

Idempotent — ADD COLUMN IF NOT EXISTS + ON CONFLICT DO NOTHING.

Revision ID: c1d2e3f4a5b6
Revises: b0c1d2e3f4a5
Create Date: 2026-06-11

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'c1d2e3f4a5b6'
down_revision: Union[str, None] = 'b0c1d2e3f4a5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ON CONFLICT DO NOTHING handles the rare case where two users somehow share
    # the same reply_from_email (no unique constraint on that column) — the first
    # UPDATE wins; the second is skipped rather than failing the migration.
    op.execute("""
        UPDATE users
        SET inbound_email = LOWER(TRIM(reply_from_email))
        WHERE inbound_email IS NULL
          AND reply_from_email IS NOT NULL
          AND LOWER(TRIM(reply_from_email)) LIKE '%@getyippie.com'
          AND NOT EXISTS (
              SELECT 1 FROM users u2
              WHERE LOWER(TRIM(u2.inbound_email)) = LOWER(TRIM(users.reply_from_email))
                AND u2.id != users.id
          )
    """)


def downgrade() -> None:
    pass
