"""perf: composite indexes for hot ticket list filters

Revision ID: a9b0c1d2e3f4
Revises: c8d9e0f1a2b3
Create Date: 2026-06-10 00:00:00.000000

asyncpg requires one SQL statement per op.execute() call.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'a9b0c1d2e3f4'
down_revision: Union[str, None] = 'c8d9e0f1a2b3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Idempotent DDL — devsandbox + sandbox deploy against one shared DB.
    # Ticket lists filter (tenant_id, status) and exclude soft-deleted rows;
    # the assignee view filters (tenant_id, assigned_to).
    op.execute("CREATE INDEX IF NOT EXISTS ix_tickets_tenant_status_deleted ON tickets (tenant_id, status, deleted_at)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_tickets_tenant_assigned ON tickets (tenant_id, assigned_to)")


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_tickets_tenant_assigned")
    op.execute("DROP INDEX IF EXISTS ix_tickets_tenant_status_deleted")
