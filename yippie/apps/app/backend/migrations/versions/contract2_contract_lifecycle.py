"""contract2 — contract lifecycle + value columns (Contracts module, phase 2)

Revision ID: contract2_contract_lifecycle
Revises: contract1_contracts_table
Create Date: 2026-07-06

Adds lifecycle fields (start/end dates, notice period, auto renew + renewal
term), contract value (amount, interval, currency — shaped so Stripe can
consume them in phase 3), and two reminder dedupe timestamps used by the
renewal scheduler. notice_deadline is derived at the app layer
(end_date − notice_period_days), not stored.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "contract2_contract_lifecycle"
down_revision: Union[str, None] = "contract1_contracts_table"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

COLUMNS = (
    ("start_date", "DATE"),
    ("end_date", "DATE"),
    ("notice_period_days", "INTEGER"),
    ("auto_renew", "BOOLEAN NOT NULL DEFAULT false"),
    ("renewal_term", "VARCHAR(10)"),
    ("value_amount", "NUMERIC(12,2)"),
    ("value_interval", "VARCHAR(10)"),
    ("currency", "VARCHAR(3) NOT NULL DEFAULT 'EUR'"),
    ("notice_reminder_sent_at", "TIMESTAMPTZ"),
    ("expiry_reminder_sent_at", "TIMESTAMPTZ"),
)


def upgrade() -> None:
    for name, ddl in COLUMNS:
        op.execute(f"ALTER TABLE contracts ADD COLUMN IF NOT EXISTS {name} {ddl}")
    # The renewal scheduler and Renewals view both filter on end_date.
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_contracts_tenant_end_date "
        "ON contracts (tenant_id, end_date)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_contracts_tenant_end_date")
    for name, _ in COLUMNS:
        op.execute(f"ALTER TABLE contracts DROP COLUMN IF EXISTS {name}")
