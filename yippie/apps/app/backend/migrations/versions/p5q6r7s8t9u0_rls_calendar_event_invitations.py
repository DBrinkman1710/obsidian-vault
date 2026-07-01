"""Add RLS tenant isolation to calendar_event_invitations

Revision ID: p5q6r7s8t9u0
Revises: h3i4j5k6l7m8
Create Date: 2026-07-01

calendar_event_invitations was added in h3i4j5k6l7m8 without RLS policies —
the only table in the schema missing the defence-in-depth guarantee. All other
tables were covered by c3d4e5f6a7b8 and n4o5p6q7r8s9. This migration closes
the gap using the same standard pattern.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'p5q6r7s8t9u0'
down_revision: Union[str, None] = 'h3i4j5k6l7m8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TABLE calendar_event_invitations ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE calendar_event_invitations FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON calendar_event_invitations")
    op.execute("""
        CREATE POLICY tenant_isolation ON calendar_event_invitations
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON calendar_event_invitations TO app_user")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON calendar_event_invitations")
    op.execute("ALTER TABLE calendar_event_invitations NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE calendar_event_invitations DISABLE ROW LEVEL SECURITY")
