"""add composite index on contact_pipeline_entries (tenant_id, entered_at)

Revision ID: a1b2_pipeline_board_index
Revises: sec1_rls_shipments
Create Date: 2026-06-30

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'a1b2_pipeline_board_index'
down_revision: Union[str, None] = 'sec1_rls_shipments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_pipeline_entries_tenant_entered',
        'contact_pipeline_entries',
        ['tenant_id', 'entered_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_pipeline_entries_tenant_entered', table_name='contact_pipeline_entries')
