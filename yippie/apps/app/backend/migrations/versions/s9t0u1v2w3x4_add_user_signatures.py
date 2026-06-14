"""add user_signatures table (multi-signature per user, S1/S2)

Revision ID: s9t0u1v2w3x4
Revises: r8s9t0u1v2w3
Create Date: 2026-06-14

Creates the user_signatures table, applies the standard RLS tenant_isolation
policy (copied from n4o5p6q7r8s9), and backfills one "Default" signature row
for every user that currently has a non-null email_signature.

The legacy users.email_signature column is intentionally KEPT for backward
compatibility (older clients / rollback safety). Dropping it is a follow-up
once everything reads from user_signatures.
"""
from typing import Sequence, Union

from alembic import op

revision: str = 's9t0u1v2w3x4'
down_revision: Union[str, None] = 'r8s9t0u1v2w3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
        CREATE TABLE IF NOT EXISTS user_signatures (
            id UUID PRIMARY KEY,
            user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            tenant_id UUID NOT NULL REFERENCES tenants(id),
            name VARCHAR(120) NOT NULL,
            body TEXT NOT NULL DEFAULT '',
            is_default BOOLEAN NOT NULL DEFAULT false,
            display_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    """)
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_signatures_tenant_id ON user_signatures (tenant_id)")
    op.execute("CREATE INDEX IF NOT EXISTS ix_user_signatures_user_id ON user_signatures (user_id)")

    # --- Backfill: one "Default" signature per user with an existing signature ---
    op.execute("""
        INSERT INTO user_signatures (id, user_id, tenant_id, name, body, is_default, display_order)
        SELECT gen_random_uuid(), u.id, u.tenant_id, 'Default', u.email_signature, true, 0
        FROM users u
        WHERE u.email_signature IS NOT NULL
          AND length(trim(u.email_signature)) > 0
    """)

    # --- RLS: standard tenant_isolation policy (matches n4o5p6q7r8s9) ---
    op.execute("ALTER TABLE user_signatures ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE user_signatures FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON user_signatures")
    op.execute("""
        CREATE POLICY tenant_isolation ON user_signatures
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON user_signatures TO app_user")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON user_signatures")
    op.execute("ALTER TABLE user_signatures NO FORCE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE user_signatures DISABLE ROW LEVEL SECURITY")
    op.execute("DROP TABLE IF EXISTS user_signatures")
