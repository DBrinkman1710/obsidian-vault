"""heal contacts.deleted_at (idempotent self-heal)

Revision ID: ef0754082c3f
Revises: z9a0b1c2d3e4
Create Date: 2026-06-17 04:38:08.754465

The contact soft-delete migration (w3x4y5z6a7b8) adds contacts.deleted_at, but on
the Sandbox DB the column is missing even though alembic_version had advanced past
that revision -- the footprint of an `alembic stamp` used to escape the multi-head
merges in mid-June. Because the version pointer is already at/past w3x4y5z6a7b8,
`alembic upgrade heads` is a no-op there and never re-runs the ADD COLUMN, so every
contacts query (list/create/get all filter `deleted_at IS NULL`) 500s with
"column contacts.deleted_at does not exist".

This corrective migration sits at a NEW head, so `alembic upgrade heads` runs it on
the next deploy regardless of the inconsistent version pointer. ADD COLUMN IF NOT
EXISTS makes it a safe no-op on every environment where the real migration already
applied (local, prod, etc.).

asyncpg uses the extended query protocol -> one statement per op.execute().
"""
from typing import Sequence, Union
from alembic import op


revision: str = 'ef0754082c3f'
down_revision: Union[str, None] = 'z9a0b1c2d3e4'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "ALTER TABLE contacts ADD COLUMN IF NOT EXISTS deleted_at timestamptz"
    )


def downgrade() -> None:
    # No-op: the base column is owned by w3x4y5z6a7b8; this revision only heals a gap.
    pass
