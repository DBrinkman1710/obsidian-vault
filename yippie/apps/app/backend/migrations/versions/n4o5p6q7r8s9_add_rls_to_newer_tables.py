"""Add Row-Level Security tenant isolation to 8 newer tables

Revision ID: n4o5p6q7r8s9
Revises: m3n4o5p6q7r8
Create Date: 2026-06-14

Adds RLS tenant_isolation policies to tables that were created after the
original RLS migration (c3d4e5f6a7b8) and were therefore left unprotected:
companies, contact_labels, contact_label_links, label_click_tokens,
outbound_emails, pending_sends, pipeline_stages, contact_pipeline_entries.

The app_user role, app_tenant_id() helper, and ALTER DEFAULT PRIVILEGES
grants already exist (c3d4e5f6a7b8 + c9d0e1f2a3b4). Explicit GRANTs are
repeated here as cheap insurance, matching the calendar migration pattern.

contact_label_links is a pure junction table with no tenant_id, so it uses
a subquery policy that joins through contacts.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'n4o5p6q7r8s9'
down_revision: Union[str, None] = 'm3n4o5p6q7r8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Tables that carry tenant_id directly and use the standard policy.
TENANT_TABLES = [
    "companies",
    "contact_labels",
    "label_click_tokens",
    "outbound_emails",
    "pending_sends",
    "pipeline_stages",
    "contact_pipeline_entries",
]

# All 8 tables, used for the downgrade.
ALL_TABLES = TENANT_TABLES + ["contact_label_links"]


def upgrade() -> None:
    # --- 7 tables with a tenant_id column: standard tenant_isolation policy ---
    for table in TENANT_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"""
            CREATE POLICY tenant_isolation ON {table}
                USING     (tenant_id = app_tenant_id())
                WITH CHECK (tenant_id = app_tenant_id())
        """)
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO app_user")

    # --- contact_label_links: pure junction table, no tenant_id column ---
    # Isolate by joining through contacts to its tenant_id.
    op.execute("ALTER TABLE contact_label_links ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE contact_label_links FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON contact_label_links")
    op.execute("""
        CREATE POLICY tenant_isolation ON contact_label_links
            USING (
                EXISTS (
                    SELECT 1 FROM contacts c
                    WHERE c.id = contact_label_links.contact_id
                      AND c.tenant_id = app_tenant_id()
                )
            )
            WITH CHECK (
                EXISTS (
                    SELECT 1 FROM contacts c
                    WHERE c.id = contact_label_links.contact_id
                      AND c.tenant_id = app_tenant_id()
                )
            )
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON contact_label_links TO app_user")


def downgrade() -> None:
    for table in ALL_TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
