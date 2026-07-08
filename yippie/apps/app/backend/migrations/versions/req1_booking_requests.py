"""req1 — customer requested bookings: booking_requests table + settings columns

Revision ID: req1_booking_requests
Revises: worker1_worker_availability
Create Date: 2026-07-08

Adds the reverse booking direction. calendar_settings gains booking_direction
(availability vs requests) and request_fulfillment (dispatcher vs self_claim).
booking_requests holds customer-initiated appointment requests that a worker or
dispatcher turns into a confirmed calendar event.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "req1_booking_requests"
down_revision: Union[str, None] = "worker1_worker_availability"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE calendar_settings "
        "ADD COLUMN IF NOT EXISTS booking_direction VARCHAR(20) NOT NULL DEFAULT 'availability'"
    )
    op.execute(
        "ALTER TABLE calendar_settings "
        "ADD COLUMN IF NOT EXISTS request_fulfillment VARCHAR(20) NOT NULL DEFAULT 'dispatcher'"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS booking_requests (
            id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id          UUID        NOT NULL,
            contact_id         UUID        NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
            requested_slots    JSONB,
            message            TEXT,
            status             VARCHAR(20) NOT NULL DEFAULT 'open',
            assigned_worker_id UUID        REFERENCES users(id) ON DELETE SET NULL,
            fulfilled_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
            event_id           UUID        REFERENCES calendar_events(id) ON DELETE SET NULL,
            chosen_slot_start  TIMESTAMPTZ,
            chosen_slot_end    TIMESTAMPTZ,
            created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_booking_requests_tenant_status "
        "ON booking_requests (tenant_id, status)"
    )

    op.execute("ALTER TABLE booking_requests ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE booking_requests FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON booking_requests")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON booking_requests
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON booking_requests TO app_user")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS booking_requests")
    op.execute("ALTER TABLE calendar_settings DROP COLUMN IF EXISTS request_fulfillment")
    op.execute("ALTER TABLE calendar_settings DROP COLUMN IF EXISTS booking_direction")
