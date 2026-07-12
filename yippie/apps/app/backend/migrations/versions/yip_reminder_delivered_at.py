"""user_reminders.delivered_at — persist reminder delivery so restarts/workers don't re-fire

Revision ID: yip_reminder_delivered_at
Revises: uxp2_pipeline_nudge_toggle
Create Date: 2026-07-12

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'yip_reminder_delivered_at'
down_revision: Union[str, Sequence[str], None] = 'uxp2_pipeline_nudge_toggle'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "user_reminders",
        sa.Column("delivered_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("user_reminders", "delivered_at")
