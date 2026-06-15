"""perf: pg_trgm GIN indexes for inbox search (drafts, inbound, outbound)

Revision ID: t0u1v2w3x4y5
Revises: s9t0u1v2w3x4
Create Date: 2026-06-15

Adds trigram GIN indexes backing the [I1] inbox search ILIKE filters across
Pending/Processed (draft_tickets + inbound_messages) and Sent (outbound_emails).
Mirrors the existing contacts_*_trgm indexes from c0d1e2f3a4b5.
"""
from typing import Sequence, Union

from alembic import op


revision: str = "t0u1v2w3x4y5"
down_revision: Union[str, None] = "s9t0u1v2w3x4"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    # Pending/Processed search fields
    op.execute(
        "CREATE INDEX IF NOT EXISTS draft_tickets_ai_subject_trgm "
        "ON draft_tickets USING gin (ai_suggested_subject gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS draft_tickets_ai_description_trgm "
        "ON draft_tickets USING gin (ai_suggested_description gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS inbound_messages_subject_trgm "
        "ON inbound_messages USING gin (subject gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS inbound_messages_sender_trgm "
        "ON inbound_messages USING gin (sender gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS inbound_messages_raw_body_trgm "
        "ON inbound_messages USING gin (raw_body gin_trgm_ops)"
    )
    # Sent tab search fields
    op.execute(
        "CREATE INDEX IF NOT EXISTS outbound_emails_subject_trgm "
        "ON outbound_emails USING gin (subject gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS outbound_emails_to_email_trgm "
        "ON outbound_emails USING gin (to_email gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS outbound_emails_to_email_trgm")
    op.execute("DROP INDEX IF EXISTS outbound_emails_subject_trgm")
    op.execute("DROP INDEX IF EXISTS inbound_messages_raw_body_trgm")
    op.execute("DROP INDEX IF EXISTS inbound_messages_sender_trgm")
    op.execute("DROP INDEX IF EXISTS inbound_messages_subject_trgm")
    op.execute("DROP INDEX IF EXISTS draft_tickets_ai_description_trgm")
    op.execute("DROP INDEX IF EXISTS draft_tickets_ai_subject_trgm")
