"""wk1 — tenant-wide date-specific bookable availability overrides

Revision ID: wk1_cal_avail_exceptions
Revises: schedsend_pending_scheduled
Create Date: 2026-09-17

NOTE: the revision id is kept <= 32 chars — alembic_version.version_num is
VARCHAR(32), so a longer id overflows the version stamp and fails the deploy.

calendar_availability_exceptions holds one-off date overrides for the SHARED
(tenant-wide) bookable schedule — the mirror of worker_availability_exceptions
without a user_id. An empty/null slots list closes the tenant that day; a
populated list replaces that weekday's recurring calendar_settings.weekly_slots
for that date only. Powers the calendar week-view availability editor.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "wk1_cal_avail_exceptions"
down_revision: Union[str, None] = "schedsend_pending_scheduled"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS calendar_availability_exceptions (
            id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id  UUID        NOT NULL,
            date       DATE        NOT NULL,
            slots      JSONB,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_calendar_exception_tenant_date UNIQUE (tenant_id, date)
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_calendar_availability_exceptions_tenant "
        "ON calendar_availability_exceptions (tenant_id)"
    )

    # Row-level security — tenant isolation, consistent with every other table.
    op.execute("ALTER TABLE calendar_availability_exceptions ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE calendar_availability_exceptions FORCE ROW LEVEL SECURITY")
    op.execute(
        "DROP POLICY IF EXISTS tenant_isolation ON calendar_availability_exceptions"
    )
    op.execute(
        """
        CREATE POLICY tenant_isolation ON calendar_availability_exceptions
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute(
        "GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_availability_exceptions TO app_user"
    )


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS calendar_availability_exceptions")
