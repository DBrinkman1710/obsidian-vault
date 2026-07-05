"""contract1 — contracts table (Contracts module, phase 1: storage)

Revision ID: contract1_contracts_table
Revises: eml1_email_accounts
Create Date: 2026-07-05

New €9/mo Contracts module. Phase 1 stores contracts (title, type, status,
direction, counterparty company/contact, tags, notes) plus an optional uploaded
document held inline as BYTEA. status/direction are plain VARCHARs (validated at
the app layer) so future values never need an ALTER TYPE.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "contract1_contracts_table"
down_revision: Union[str, None] = "eml1_email_accounts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS contracts (
            id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id         UUID        NOT NULL,
            title             VARCHAR(255) NOT NULL,
            contract_type     VARCHAR(100),
            status            VARCHAR(20) NOT NULL DEFAULT 'draft',
            direction         VARCHAR(20) NOT NULL DEFAULT 'issued',
            company_id        UUID        REFERENCES companies(id) ON DELETE SET NULL,
            contact_id        UUID        REFERENCES contacts(id)  ON DELETE SET NULL,
            counterparty_name VARCHAR(255),
            owner_user_id     UUID,
            tags              JSONB       NOT NULL DEFAULT '[]',
            notes             TEXT,
            file_name         VARCHAR(255),
            file_type         VARCHAR(100),
            file_size         INTEGER,
            file_data         BYTEA,
            created_by        UUID,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_contracts_tenant_created "
        "ON contracts (tenant_id, created_at DESC)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_contracts_tenant_company "
        "ON contracts (tenant_id, company_id)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_contracts_tenant_contact "
        "ON contracts (tenant_id, contact_id)"
    )

    # Row-level security — tenant isolation, consistent with every other table.
    op.execute("ALTER TABLE contracts ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE contracts FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON contracts")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON contracts
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON contracts TO app_user")


def downgrade() -> None:
    op.execute("DROP TABLE IF EXISTS contracts")
