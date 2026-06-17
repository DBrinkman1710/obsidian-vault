"""add calendar_settings and booking_tokens tables for the booking system (BK1)

Revision ID: v2w3x4y5z6a7
Revises: r8s9t0u1v2w3
Create Date: 2026-06-15

asyncpg requires one SQL command per op.execute() (extended query protocol).
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'v2w3x4y5z6a7'
down_revision: Union[str, None] = 'r8s9t0u1v2w3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # --- calendar_settings -------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS calendar_settings (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL UNIQUE REFERENCES tenants(id),
            work_start_hour INTEGER NOT NULL DEFAULT 9,
            work_end_hour INTEGER NOT NULL DEFAULT 17,
            slot_minutes INTEGER NOT NULL DEFAULT 30,
            booking_expiry_days INTEGER NOT NULL DEFAULT 3,
            post_booking_stage_id UUID REFERENCES pipeline_stages(id) ON DELETE SET NULL
        )
    """)

    op.execute("ALTER TABLE calendar_settings ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE calendar_settings FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON calendar_settings")
    op.execute("""
        CREATE POLICY tenant_isolation ON calendar_settings
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_settings TO app_user")

    # --- booking_tokens ----------------------------------------------------
    op.execute("""
        CREATE TABLE IF NOT EXISTS booking_tokens (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
            created_by UUID NOT NULL REFERENCES users(id),
            mode VARCHAR(10) NOT NULL,
            proposed_slots JSONB,
            message TEXT,
            expires_at TIMESTAMPTZ NOT NULL,
            booked_at TIMESTAMPTZ,
            event_id UUID REFERENCES calendar_events(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_booking_tokens_tenant "
        "ON booking_tokens (tenant_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_booking_tokens_contact "
        "ON booking_tokens (contact_id)"
    )

    op.execute("ALTER TABLE booking_tokens ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE booking_tokens FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON booking_tokens")
    op.execute("""
        CREATE POLICY tenant_isolation ON booking_tokens
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON booking_tokens TO app_user")

    # Enable the booking module for existing tenants (new tenants default to ALL_MODULES).
    op.execute(
        "UPDATE tenants SET enabled_modules = array_append(enabled_modules, 'booking') "
        "WHERE NOT ('booking' = ANY(enabled_modules))"
    )


def downgrade() -> None:
    op.execute(
        "UPDATE tenants SET enabled_modules = array_remove(enabled_modules, 'booking') "
        "WHERE 'booking' = ANY(enabled_modules)"
    )
    op.execute("DROP TABLE IF EXISTS booking_tokens")
    op.execute("DROP TABLE IF EXISTS calendar_settings")
