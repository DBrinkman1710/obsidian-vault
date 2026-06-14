"""Add per-user contact column preferences

Revision ID: r8s9t0u1v2w3
Revises: q7r8s9t0u1v2
Create Date: 2026-06-14

Adds contact_column_prefs JSONB to users so each user stores their own
show/hide + ordering config for the Contacts table. Nullable; existing users
get NULL and the frontend falls back to default columns.
"""

from alembic import op

revision = 'r8s9t0u1v2w3'
down_revision = 'q7r8s9t0u1v2'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS contact_column_prefs JSONB")


def downgrade() -> None:
    op.execute("ALTER TABLE users DROP COLUMN IF EXISTS contact_column_prefs")
