"""[INV2] NL/EU invoice compliance: gapless numbering, immutability, reverse charge

Revision ID: inv2_invoice_compliance
Revises: tmpl1_template_blocks
Create Date: 2026-07-31

Five compliance gaps closed:

  invoice_counters          NEW: persistent per tenant number sequence. Replaces
                            COUNT(*) based numbering, which reused a number after
                            an invoice was deleted (legally forbidden).
  invoices.issued_at        Single source of truth for immutability. NULL = draft
                            (editable), NOT NULL = legally issued (locked).
  invoices.invoice_number   Now nullable — a number is claimed at issue time, not
                            at creation, so the issued series has no gaps from
                            discarded drafts. Existing rows keep their numbers.
  invoices.reverse_charge   BTW verlegd (intra EU B2B). Distinct from a 0% rate,
                            which means exempt and is a different legal statement.
  invoices.*_snapshot       Seller/client details frozen at issue. The PDF used to
                            re render from live tenant/contact rows, so reprinting
                            an old invoice after an address change produced a
                            different document than the one that was sent.
  contacts.btw_nummer/…     Client VAT number + address. Both legally required on
                            a business invoice and neither existed anywhere.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "inv2_invoice_compliance"
down_revision: Union[str, Sequence[str], None] = "tmpl1_template_blocks"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# Statuses that mean the document has left the building. Everything else
# (draft / pending / not_sent) is still a working copy.
ISSUED_STATUSES = "('sent', 'paid', 'overdue', 'received', 'void')"


def upgrade() -> None:
    # ── contacts: client legal identity ───────────────────────────────────────
    op.execute(
        """
        ALTER TABLE contacts
            ADD COLUMN IF NOT EXISTS btw_nummer     VARCHAR(100),
            ADD COLUMN IF NOT EXISTS street_address VARCHAR(255),
            ADD COLUMN IF NOT EXISTS postal_code    VARCHAR(20),
            ADD COLUMN IF NOT EXISTS city           VARCHAR(100),
            ADD COLUMN IF NOT EXISTS country        VARCHAR(100)
        """
    )

    # ── invoices: lifecycle, VAT treatment, frozen copies ─────────────────────
    op.execute(
        """
        ALTER TABLE invoices
            ADD COLUMN IF NOT EXISTS issued_at         TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS reverse_charge    BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS payment_terms     TEXT,
            ADD COLUMN IF NOT EXISTS credit_note_of_id UUID,
            ADD COLUMN IF NOT EXISTS seller_snapshot   JSONB,
            ADD COLUMN IF NOT EXISTS client_snapshot   JSONB
        """
    )
    op.execute(
        """
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM pg_constraint WHERE conname = 'fk_invoices_credit_note_of'
            ) THEN
                ALTER TABLE invoices
                    ADD CONSTRAINT fk_invoices_credit_note_of
                    FOREIGN KEY (credit_note_of_id) REFERENCES invoices (id) ON DELETE SET NULL;
            END IF;
        END $$
        """
    )

    # A number is claimed when the invoice is issued. Drafts carry NULL and show
    # as CONCEPT. Postgres allows many NULLs under a UNIQUE constraint, so
    # uq_invoices_tenant_number keeps protecting the issued series.
    op.execute("ALTER TABLE invoices ALTER COLUMN invoice_number DROP NOT NULL")

    # Everything already sent is issued — lock it at its creation time.
    op.execute(
        f"""
        UPDATE invoices
           SET issued_at = COALESCE(created_at, NOW())
         WHERE issued_at IS NULL
           AND status::text IN {ISSUED_STATUSES}
        """
    )

    # ── invoice_counters: the real sequence ───────────────────────────────────
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS invoice_counters (
            tenant_id   UUID PRIMARY KEY,
            prefix      VARCHAR(20)  NOT NULL DEFAULT 'INV',
            last_number INTEGER      NOT NULL DEFAULT 0,
            updated_at  TIMESTAMPTZ  NOT NULL DEFAULT NOW()
        )
        """
    )
    # Seed each tenant's counter from the highest number it has already used, so
    # no existing number can ever be handed out a second time.
    op.execute(
        """
        INSERT INTO invoice_counters (tenant_id, last_number)
        SELECT tenant_id,
               COALESCE(MAX(NULLIF(regexp_replace(invoice_number, '\\D', '', 'g'), '')::bigint), 0)
        FROM invoices
        WHERE invoice_number IS NOT NULL
        GROUP BY tenant_id
        ON CONFLICT (tenant_id) DO NOTHING
        """
    )

    # RLS, matching every other tenant scoped table (c3d4e5f6a7b8 pattern).
    op.execute("ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE invoice_counters FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON invoice_counters")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON invoice_counters
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON invoice_counters TO app_user")

    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_invoices_tenant_issued ON invoices (tenant_id, issued_at)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_invoices_tenant_issued")
    op.execute("DROP TABLE IF EXISTS invoice_counters")

    # Restore NOT NULL: drafts that never got a number would violate it, so give
    # them a clearly non legal placeholder rather than dropping the rows.
    op.execute(
        """
        UPDATE invoices
           SET invoice_number = 'DRAFT-' || substr(id::text, 1, 8)
         WHERE invoice_number IS NULL
        """
    )
    op.execute("ALTER TABLE invoices ALTER COLUMN invoice_number SET NOT NULL")

    op.execute("ALTER TABLE invoices DROP CONSTRAINT IF EXISTS fk_invoices_credit_note_of")
    op.execute(
        """
        ALTER TABLE invoices
            DROP COLUMN IF EXISTS client_snapshot,
            DROP COLUMN IF EXISTS seller_snapshot,
            DROP COLUMN IF EXISTS credit_note_of_id,
            DROP COLUMN IF EXISTS payment_terms,
            DROP COLUMN IF EXISTS reverse_charge,
            DROP COLUMN IF EXISTS issued_at
        """
    )
    op.execute(
        """
        ALTER TABLE contacts
            DROP COLUMN IF EXISTS country,
            DROP COLUMN IF EXISTS city,
            DROP COLUMN IF EXISTS postal_code,
            DROP COLUMN IF EXISTS street_address,
            DROP COLUMN IF EXISTS btw_nummer
        """
    )
