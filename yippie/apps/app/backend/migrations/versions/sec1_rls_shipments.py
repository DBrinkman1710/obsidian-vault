"""[SEC1] Add RLS tenant isolation to shipments and shipment_events

Revision ID: sec1_rls_shipments
Revises: inv1_invoice_overhaul
Create Date: 2026-06-30

Both tables carry tenant_id but were created in track1_shipments_module without
RLS policies, leaving shipment data unprotected at the database level.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'sec1_rls_shipments'
down_revision: Union[str, None] = 'inv1_invoice_overhaul'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = ["shipments", "shipment_events"]


def upgrade() -> None:
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"""
            CREATE POLICY tenant_isolation ON {table}
                USING     (tenant_id = app_tenant_id())
                WITH CHECK (tenant_id = app_tenant_id())
        """)
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO app_user")


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
