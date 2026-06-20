"""dept routing: user shared_inbox_disabled

Revision ID: sharedinbox_001
Revises: rbac_001
Create Date: 2026-06-20

Adds the per-user Personal Work Inbox toggle (users.shared_inbox_disabled).
When set, the shared mailbox only shows drafts assigned to the user or sent
to their personal inbound address.
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "sharedinbox_001"
down_revision: Union[str, None] = "rbac_001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "shared_inbox_disabled",
            sa.Boolean(),
            nullable=False,
            server_default="false",
        ),
    )


def downgrade() -> None:
    op.drop_column("users", "shared_inbox_disabled")
