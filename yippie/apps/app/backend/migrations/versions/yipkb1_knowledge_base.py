"""[YIP-KB] per tenant knowledge base — kb_source + kb_chunk

Revision ID: yipkb1_knowledge_base
Revises: kanflow1_pipeline_flowcharts
Create Date: 2026-08-07

One knowledge source (the tenant's own FAQ / Q&A page URL) per tenant, chunked
into kb_chunk rows so AI reply drafts can be grounded in the tenant's own help
content with a bounded prompt.

Written defensively (IF NOT EXISTS / DROP POLICY IF EXISTS) because this DB has
known schema drift — a partially applied or re-run deploy must never abort. The
RLS tenant_isolation policies match the n4o5p6q7r8s9 pattern so RLS coverage
stays complete on every tenant table.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "yipkb1_knowledge_base"
down_revision: Union[str, Sequence[str], None] = "kanflow1_pipeline_flowcharts"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # One source per tenant — the UNIQUE on tenant_id enforces it (single URL v1).
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS kb_source (
            id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id       UUID        NOT NULL UNIQUE,
            url             TEXT        NOT NULL,
            status          TEXT        NOT NULL DEFAULT 'pending',
            last_fetched_at TIMESTAMPTZ,
            error           TEXT,
            char_count      INTEGER     NOT NULL DEFAULT 0,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS kb_chunk (
            id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id      UUID        NOT NULL,
            source_id      UUID        NOT NULL REFERENCES kb_source(id) ON DELETE CASCADE,
            heading        TEXT,
            content        TEXT        NOT NULL,
            token_estimate INTEGER     NOT NULL DEFAULT 0,
            created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_kb_chunk_tenant_source ON kb_chunk (tenant_id, source_id)")

    # RLS: standard tenant_isolation, matching the n4o5p6q7r8s9 policy pattern.
    for table in ("kb_source", "kb_chunk"):
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(
            f"""
            CREATE POLICY tenant_isolation ON {table}
                USING     (tenant_id = app_tenant_id())
                WITH CHECK (tenant_id = app_tenant_id())
            """
        )
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO app_user")


def downgrade() -> None:
    for table in ("kb_chunk", "kb_source"):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"DROP TABLE IF EXISTS {table}")
