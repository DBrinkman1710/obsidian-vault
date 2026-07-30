"""[TMPL1] block based document templates — contract template blocks + invoice_templates

Revision ID: tmpl1_template_blocks
Revises: contacts_fk_set_null
Create Date: 2026-07-16

Drag and drop template builder foundation:

  contract_templates.blocks     — structured JSON block layout ({"version": 1, "blocks": [...]})
                                  existing plain text bodies are wrapped into a single text block
  contract_templates.schema_version — block schema version for future evolution
  contracts.rendered_blocks     — merge resolved copy frozen at generation time (signing integrity)
  invoice_templates             — NEW: per tenant invoice layouts + defaults (tax rate, due days, notes)
  invoices.template_id          — per invoice template override
"""
from typing import Sequence, Union

from alembic import op

revision: str = "tmpl1_template_blocks"
down_revision: Union[str, Sequence[str], None] = "contacts_fk_set_null"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ── contract_templates: structured blocks alongside the plain text body ──
    op.execute(
        """
        ALTER TABLE contract_templates
            ADD COLUMN IF NOT EXISTS blocks JSONB,
            ADD COLUMN IF NOT EXISTS schema_version INT NOT NULL DEFAULT 1
        """
    )
    # Wrap every existing plain text body into a single text block so old
    # templates open in the builder as one editable paragraph block.
    op.execute(
        """
        UPDATE contract_templates SET blocks = jsonb_build_object(
            'version', 1,
            'blocks', jsonb_build_array(jsonb_build_object(
                'id', 'b_' || substr(md5(random()::text), 1, 8),
                'type', 'text',
                'config', jsonb_build_object('text', body, 'size', 'md', 'align', 'left'))))
        WHERE blocks IS NULL
        """
    )
    op.execute(
        """
        ALTER TABLE contract_templates
            ALTER COLUMN blocks SET DEFAULT '{"version": 1, "blocks": []}'::jsonb,
            ALTER COLUMN blocks SET NOT NULL
        """
    )

    # ── contracts: frozen merge resolved blocks at generation time ──
    op.execute("ALTER TABLE contracts ADD COLUMN IF NOT EXISTS rendered_blocks JSONB")

    # ── invoice_templates: layout blocks + invoice defaults per tenant ──
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS invoice_templates (
            id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id            UUID         NOT NULL,
            name                 VARCHAR(255) NOT NULL,
            blocks               JSONB        NOT NULL DEFAULT '{"version": 1, "blocks": []}'::jsonb,
            schema_version       INT          NOT NULL DEFAULT 1,
            default_tax_rate_pct INT,
            default_due_days     INT,
            default_notes        TEXT,
            is_default           BOOLEAN      NOT NULL DEFAULT FALSE,
            created_by           UUID,
            created_at           TIMESTAMPTZ  NOT NULL DEFAULT now(),
            updated_at           TIMESTAMPTZ  NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_invoice_templates_tenant "
        "ON invoice_templates (tenant_id)"
    )
    # Exactly one default template per tenant.
    op.execute(
        "CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_templates_tenant_default "
        "ON invoice_templates (tenant_id) WHERE is_default"
    )
    op.execute("ALTER TABLE invoice_templates ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE invoice_templates FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON invoice_templates")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON invoice_templates
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_templates TO app_user")

    # ── invoices: optional per invoice template override ──
    op.execute(
        """
        ALTER TABLE invoices
            ADD COLUMN IF NOT EXISTS template_id UUID
                REFERENCES invoice_templates(id) ON DELETE SET NULL
        """
    )


def downgrade() -> None:
    op.execute("ALTER TABLE invoices DROP COLUMN IF EXISTS template_id")
    op.execute("DROP TABLE IF EXISTS invoice_templates")
    op.execute("ALTER TABLE contracts DROP COLUMN IF EXISTS rendered_blocks")
    op.execute(
        """
        ALTER TABLE contract_templates
            DROP COLUMN IF EXISTS blocks,
            DROP COLUMN IF EXISTS schema_version
        """
    )
