"""worker0 — add 'worker' value to the userrole enum

Revision ID: worker0_worker_role
Revises: flows2_phase_two
Create Date: 2026-07-08

Contract workers (installation firms etc.) are invited Yippie users with a
heavily restricted role: on login they can only reach the availability screen.
The enum value is added in its own migration because PostgreSQL forbids using a
newly added enum value in the same transaction that added it — worker1 (a
separate migration = separate transaction) creates the availability tables.
"""
from typing import Sequence, Union

from alembic import op

revision: str = "worker0_worker_role"
down_revision: Union[str, None] = "flows2_phase_two"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE userrole ADD VALUE IF NOT EXISTS 'worker'")


def downgrade() -> None:
    # PostgreSQL does not support removing enum values.
    pass
