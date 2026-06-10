"""perf: async ingest — ai_status on draft_tickets

Revision ID: b0c1d2e3f4a5
Revises: a9b0c1d2e3f4
Create Date: 2026-06-10 00:00:00.000000

asyncpg requires one SQL statement per op.execute() call.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'b0c1d2e3f4a5'
down_revision: Union[str, None] = 'a9b0c1d2e3f4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent DDL — devsandbox + sandbox deploy against one shared DB.
    # Existing rows were enriched inline at ingest time, so they default to 'done'.
    op.execute("ALTER TABLE draft_tickets ADD COLUMN IF NOT EXISTS ai_status VARCHAR(20) NOT NULL DEFAULT 'done'")
    # The background enricher scans only queued rows — keep that lookup cheap.
    op.execute("CREATE INDEX IF NOT EXISTS ix_draft_tickets_ai_queued ON draft_tickets (created_at) WHERE ai_status = 'queued'")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_draft_tickets_ai_queued")
    op.execute("ALTER TABLE draft_tickets DROP COLUMN IF EXISTS ai_status")
