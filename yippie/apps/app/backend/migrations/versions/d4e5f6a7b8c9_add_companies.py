"""add companies table + contacts.company_id (item 36)

Revision ID: d4e5f6a7b8c9
Revises: b9c0d1e2f3a4
Create Date: 2026-06-12

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'b9c0d1e2f3a4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS companies (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name TEXT NOT NULL,
            domain TEXT,
            notes TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_companies_tenant_id ON companies (tenant_id)"
    )
    # One company name per tenant, case-insensitive.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_tenant_lower_name "
        "ON companies (tenant_id, lower(name))"
    )
    op.execute(
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS company_id UUID "
        "REFERENCES companies(id) ON DELETE SET NULL"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_contacts_company_id ON contacts (company_id)"
    )


def downgrade() -> None:
    op.execute("ALTER TABLE contacts DROP COLUMN IF EXISTS company_id")
    op.execute("DROP TABLE IF EXISTS companies")
