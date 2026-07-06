"""contract3 — contract templates + e-signing (Contracts module, phase 3)

Revision ID: contract3_templates_signing
Revises: contract2_contract_lifecycle
Create Date: 2026-07-06

Adds contract_templates (per-tenant, RLS) with {{merge_field}} bodies, and
signing columns on contracts: the rendered body frozen at generation time, a
public sign token (booking-token pattern → /sign/:token), and the signature
audit trail (signed_at, signer_name, signer_ip, drawn signature image).
"""
from typing import Sequence, Union

from alembic import op

revision: str = "contract3_templates_signing"
down_revision: Union[str, None] = "contract2_contract_lifecycle"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

CONTRACT_COLUMNS = (
    ("template_id", "UUID"),
    ("body", "TEXT"),
    ("sign_token", "UUID"),
    ("sign_token_expires_at", "TIMESTAMPTZ"),
    ("signed_at", "TIMESTAMPTZ"),
    ("signer_name", "VARCHAR(255)"),
    ("signer_ip", "VARCHAR(64)"),
    ("signature_image", "TEXT"),
)


def upgrade() -> None:
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS contract_templates (
            id         UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id  UUID         NOT NULL,
            name       VARCHAR(255) NOT NULL,
            body       TEXT         NOT NULL DEFAULT '',
            created_by UUID,
            created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ  NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_contract_templates_tenant "
        "ON contract_templates (tenant_id, created_at DESC)"
    )
    op.execute("ALTER TABLE contract_templates ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE contract_templates FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON contract_templates")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON contract_templates
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON contract_templates TO app_user")

    for name, ddl in CONTRACT_COLUMNS:
        op.execute(f"ALTER TABLE contracts ADD COLUMN IF NOT EXISTS {name} {ddl}")
    op.execute(
        "ALTER TABLE contracts ADD CONSTRAINT fk_contracts_template "
        "FOREIGN KEY (template_id) REFERENCES contract_templates(id) ON DELETE SET NULL"
    )
    # The public signing endpoint looks contracts up by token before any tenant
    # context exists, so the index must be global (and unique — it's a secret).
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS ux_contracts_sign_token "
        "ON contracts (sign_token) WHERE sign_token IS NOT NULL"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ux_contracts_sign_token")
    op.execute("ALTER TABLE contracts DROP CONSTRAINT IF EXISTS fk_contracts_template")
    for name, _ in CONTRACT_COLUMNS:
        op.execute(f"ALTER TABLE contracts DROP COLUMN IF EXISTS {name}")
    op.execute("DROP TABLE IF EXISTS contract_templates")
