"""add calendar_events table for calendar module

Revision ID: k1l2m3n4o5p6
Revises: j0k1l2m3n4o5
Create Date: 2026-06-12

asyncpg requires one SQL command per op.execute() (extended query protocol).
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'k1l2m3n4o5p6'
down_revision: Union[str, None] = 'j0k1l2m3n4o5'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS calendar_events (
            id UUID PRIMARY KEY,
            tenant_id UUID NOT NULL,
            title VARCHAR(255) NOT NULL,
            description TEXT,
            start_at TIMESTAMPTZ NOT NULL,
            end_at TIMESTAMPTZ,
            all_day BOOLEAN NOT NULL DEFAULT false,
            contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
            ticket_id UUID REFERENCES tickets(id) ON DELETE SET NULL,
            created_by UUID NOT NULL REFERENCES users(id),
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_calendar_events_tenant_start "
        "ON calendar_events (tenant_id, start_at)"
    )

    # RLS — same tenant_isolation policy as every other tenant-scoped table
    op.execute("ALTER TABLE calendar_events ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE calendar_events FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON calendar_events")
    op.execute("""
        CREATE POLICY tenant_isolation ON calendar_events
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
    """)
    # Explicit grant — default privileges cover this since c9d0e1f2a3b4, but the
    # pending_sends incident showed it's cheap insurance for older databases.
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_events TO app_user")

    # Enable the module for existing tenants (new tenants default to ALL_MODULES).
    # Superadmins can still toggle it off per tenant in the Clients screen.
    op.execute(
        "UPDATE tenants SET enabled_modules = array_append(enabled_modules, 'calendar') "
        "WHERE NOT ('calendar' = ANY(enabled_modules))"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE tenants SET enabled_modules = array_remove(enabled_modules, 'calendar') "
        "WHERE 'calendar' = ANY(enabled_modules)"
    )
    op.execute("DROP TABLE IF EXISTS calendar_events")
