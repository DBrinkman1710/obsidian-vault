"""[FLOW9] flows.is_default — mark the two universal default flows as showcases.

A default flow is Yippie-installed: viewable on the canvas but not editable
(duplicate to customise), deletable, and never counted against the plan's
active-flow cap. Backfills the flag onto the two universal SLA flows that
FLOW8/seed installed (matched by name + trigger + created_by IS NULL so a
tenant's own same-named flow is never claimed).

Revision ID: flows9_default_flag
Revises: flows8_builtin_migration
Create Date: 2026-07-09
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'flows9_default_flag'
down_revision: Union[str, None] = 'flows8_builtin_migration'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "flows",
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.execute(sa.text(
        "UPDATE flows SET is_default = true "
        "WHERE trigger_type = 'ticket_sla_due_soon' AND created_by IS NULL "
        "AND name IN ("
        "'Notify the assigned agent before SLA breach',"
        "'Escalate tickets before SLA breach'"
        ")"
    ))


def downgrade() -> None:
    op.drop_column("flows", "is_default")
