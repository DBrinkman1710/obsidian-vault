"""worker1 — per worker availability tables + booking assignment columns

Revision ID: worker1_worker_availability
Revises: worker0_worker_role
Create Date: 2026-07-08

worker_availability holds each worker's recurring weekly schedule; the union of
all active workers' slots drives the customer facing bookable slots.
worker_availability_exceptions holds one off date overrides. calendar_settings
gains assignment_mode (pooled vs auto_assign) and calendar_events gains
assigned_worker_id (the worker locked to an auto_assign booking).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "worker1_worker_availability"
down_revision: Union[str, None] = "worker0_worker_role"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS worker_availability (
            id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id    UUID        NOT NULL,
            user_id      UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            weekly_slots JSONB,
            timezone     VARCHAR(64),
            is_active    BOOLEAN     NOT NULL DEFAULT true,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_worker_availability_tenant_user UNIQUE (tenant_id, user_id)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_worker_availability_tenant "
        "ON worker_availability (tenant_id)"
    )

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS worker_availability_exceptions (
            id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id  UUID        NOT NULL,
            user_id    UUID        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            date       DATE        NOT NULL,
            slots      JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_worker_exception_tenant_user_date UNIQUE (tenant_id, user_id, date)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_worker_availability_exceptions_tenant "
        "ON worker_availability_exceptions (tenant_id)"
    )

    # Row-level security — tenant isolation, consistent with every other table.
    for table in ("worker_availability", "worker_availability_exceptions"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
                USING     (tenant_id = app_tenant_id())
                WITH CHECK (tenant_id = app_tenant_id())
            """
        )
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO app_user")

    op.execute(
        "ALTER TABLE calendar_settings "
        "ADD COLUMN IF NOT EXISTS assignment_mode VARCHAR(20) NOT NULL DEFAULT 'pooled'"
    )
    op.execute(
        "ALTER TABLE calendar_events "
        "ADD COLUMN IF NOT EXISTS assigned_worker_id UUID "
        "REFERENCES users(id) ON DELETE SET NULL"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE calendar_events DROP COLUMN IF EXISTS assigned_worker_id")
    op.execute("ALTER TABLE calendar_settings DROP COLUMN IF EXISTS assignment_mode")
    op.execute("DROP TABLE IF EXISTS worker_availability_exceptions")
    op.execute("DROP TABLE IF EXISTS worker_availability")
