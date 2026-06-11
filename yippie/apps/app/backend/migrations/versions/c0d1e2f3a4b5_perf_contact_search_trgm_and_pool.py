"""perf: pg_trgm GIN indexes on contacts for fast ILIKE search

Revision ID: c0d1e2f3a4b5
Revises: c1d2e3f4a5b6
Create Date: 2026-06-11

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'c0d1e2f3a4b5'
down_revision: Union[str, None] = 'c1d2e3f4a5b6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")
    op.execute(
        "CREATE INDEX IF NOT EXISTS contacts_full_name_trgm "
        "ON contacts USING gin (full_name gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS contacts_email_trgm "
        "ON contacts USING gin (email gin_trgm_ops)"
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS contacts_company_trgm "
        "ON contacts USING gin (company gin_trgm_ops)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS contacts_company_trgm")
    op.execute("DROP INDEX IF EXISTS contacts_email_trgm")
    op.execute("DROP INDEX IF EXISTS contacts_full_name_trgm")
