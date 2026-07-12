"""users.needs_password — durable flag for accounts provisioned with an auto generated password

Revision ID: signup_needs_password
Revises: yip_reminder_delivered_at
Create Date: 2026-07-12

Set at signup when no password was chosen on the form; cleared the moment the
user picks one (set_initial_password / reset_password / change_password).
Replaces the one shot ?set_password reset token URL mechanism, which lost the
obligation on refresh and silently overwrote chosen passwords on repeat entry
link clicks.

The sandbox DB has known schema drift (alembic_version stamped ahead of the
actual schema in places), so the ADD COLUMN uses IF NOT EXISTS — same
idempotent pattern as stripe1b_add_stripe_cols_heal.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 'signup_needs_password'
down_revision: Union[str, Sequence[str], None] = 'yip_reminder_delivered_at'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_password BOOLEAN NOT NULL DEFAULT false"
    )


def downgrade() -> None:
    op.drop_column('users', 'needs_password')
