"""[KAN_FLOW1] pipeline flowcharts — one AI context flowchart per tenant

Revision ID: kanflow1_pipeline_flowcharts
Revises: tmpl1_template_blocks
Create Date: 2026-08-05

Adds the pipeline_flowcharts table: a single graph (stage nodes, decision
diamonds, labelled arrows) per tenant describing how the Kanban pipeline works,
so Yippie can later reason about pipeline semantics (KAN_FLOW2).

Written defensively (IF NOT EXISTS / DROP POLICY IF EXISTS) because this DB has
known schema drift — a partially applied or re-run deploy must never abort. The
RLS tenant_isolation policy matches the n4o5p6q7r8s9 pattern so RLS coverage
stays complete on every tenant table.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "kanflow1_pipeline_flowcharts"
down_revision: Union[str, Sequence[str], None] = "wgt1_website_widget_settings"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # One flowchart per tenant — the UNIQUE on tenant_id enforces it.
    op.execute(
        """
        CREATE TABLE IF NOT EXISTS pipeline_flowcharts (
            id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id  UUID        NOT NULL UNIQUE,
            graph      JSONB       NOT NULL DEFAULT '{"nodes": [], "edges": []}'::jsonb,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
        """
    )
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_pipeline_flowcharts_tenant "
        "ON pipeline_flowcharts (tenant_id)"
    )

    # RLS: standard tenant_isolation, matching the n4o5p6q7r8s9 policy pattern.
    op.execute("ALTER TABLE pipeline_flowcharts ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE pipeline_flowcharts FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON pipeline_flowcharts")
    op.execute(
        """
        CREATE POLICY tenant_isolation ON pipeline_flowcharts
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
        """
    )
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON pipeline_flowcharts TO app_user")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON pipeline_flowcharts")
    op.execute("DROP TABLE IF EXISTS pipeline_flowcharts")
