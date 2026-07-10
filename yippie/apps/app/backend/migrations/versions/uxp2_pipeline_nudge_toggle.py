"""tenants.pipeline_nudge_enabled — admin toggle for the pipeline staleness sidebar dot

Revision ID: uxp2_pipeline_nudge_toggle
Revises: a3f8c2e91b4d
Create Date: 2026-07-10

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'uxp2_pipeline_nudge_toggle'
down_revision: Union[str, Sequence[str], None] = 'a3f8c2e91b4d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "tenants",
        sa.Column("pipeline_nudge_enabled", sa.Boolean(), nullable=False, server_default="true"),
    )


def downgrade() -> None:
    op.drop_column("tenants", "pipeline_nudge_enabled")
