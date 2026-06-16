"""add composite index on tickets (tenant_id, status, sla_due_at)

Revision ID: y5z6a7b8c9d0
Revises: v2w3x4y5z6a7
Create Date: 2026-06-15

Speeds up tenant-scoped ticket queries filtered by status and ordered/filtered
by SLA deadline (e.g. SLA escalation sweeps and ticket list views).
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'y5z6a7b8c9d0'
down_revision: Union[str, None] = 'v2w3x4y5z6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_index(
        'ix_tickets_tenant_status_sla',
        'tickets',
        ['tenant_id', 'status', 'sla_due_at'],
        if_not_exists=True,
    )


def downgrade() -> None:
    op.drop_index('ix_tickets_tenant_status_sla', table_name='tickets')
