"""external_calendar_feeds

Revision ID: a1b2c3d4e5f6
Revises: z9a0b1c2d3e4
Create Date: 2026-07-03

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'z9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "external_calendar_feeds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("ical_url", sa.Text, nullable=False),
        sa.Column("last_synced_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_sync_error", sa.Text, nullable=True),
        sa.Column("is_active", sa.Boolean, nullable=False, server_default="true"),
        sa.Column("sync_window_days", sa.Integer, nullable=False, server_default="90"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_ext_cal_feeds_tenant_user", "external_calendar_feeds", ["tenant_id", "user_id"])

    op.create_table(
        "external_calendar_events",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tenant_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("feed_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("external_calendar_feeds.id", ondelete="CASCADE"), nullable=False),
        sa.Column("uid", sa.Text, nullable=False),
        sa.Column("start_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("end_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("all_day", sa.Boolean, nullable=False, server_default="false"),
        sa.UniqueConstraint("feed_id", "uid", name="uq_ext_cal_events_feed_uid"),
    )
    op.create_index("ix_ext_cal_events_overlap", "external_calendar_events", ["tenant_id", "user_id", "start_at", "end_at"])

    # Add calendar_feed_token to users for the export feed URL
    op.add_column(
        "users",
        sa.Column(
            "calendar_feed_token",
            postgresql.UUID(as_uuid=True),
            nullable=False,
            server_default=sa.text("gen_random_uuid()"),
        ),
    )

    # Enable RLS and create tenant isolation policies
    op.execute("ALTER TABLE external_calendar_feeds ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE external_calendar_feeds FORCE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON external_calendar_feeds
        USING (tenant_id = app_tenant_id())
    """)

    op.execute("ALTER TABLE external_calendar_events ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE external_calendar_events FORCE ROW LEVEL SECURITY")
    op.execute("""
        CREATE POLICY tenant_isolation ON external_calendar_events
        USING (tenant_id = app_tenant_id())
    """)

    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON external_calendar_feeds TO app_user")
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON external_calendar_events TO app_user")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS external_calendar_events CASCADE")
    op.execute("DROP TABLE IF EXISTS external_calendar_feeds CASCADE")
    op.drop_column("users", "calendar_feed_token")
