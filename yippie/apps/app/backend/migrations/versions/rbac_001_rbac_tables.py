"""Add RBAC tables: rbac_roles, rbac_user_roles, permissions_matrix

Revision ID: rbac_001
Revises: f7g8h9i0j1k2, dept_members_001
Create Date: 2026-06-20

Merges f7g8h9i0j1k2 (demo_expires_at) and dept_members_001 heads,
then creates the three RBAC tables with perm_subject_type and
access_level_enum Postgres enums.
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'rbac_001'
down_revision: Union[str, Sequence[str], None] = (
    'f7g8h9i0j1k2',
    'dept_members_001',
)
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

RBAC_TABLES = ['rbac_roles', 'rbac_user_roles', 'permissions_matrix']


def upgrade() -> None:
    conn = op.get_bind()

    # Create Postgres enum types (models set create_type=False, so we own them)
    conn.execute(sa.text(
        "DO $$ BEGIN "
        "  CREATE TYPE perm_subject_type AS ENUM ('user', 'role', 'department'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$"
    ))
    conn.execute(sa.text(
        "DO $$ BEGIN "
        "  CREATE TYPE access_level_enum AS ENUM ('full', 'view', 'restricted'); "
        "EXCEPTION WHEN duplicate_object THEN NULL; "
        "END $$"
    ))

    # rbac_roles: tenant-scoped named roles
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS rbac_roles (
            id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id  UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
            name       VARCHAR(100) NOT NULL,
            created_at TIMESTAMPTZ DEFAULT now()
        )
    """))

    # rbac_user_roles: maps users to RBAC roles (many-to-many)
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS rbac_user_roles (
            id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id UUID NOT NULL,
            user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role_id   UUID NOT NULL REFERENCES rbac_roles(id) ON DELETE CASCADE,
            CONSTRAINT uq_rbac_user_role UNIQUE (user_id, role_id)
        )
    """))

    # permissions_matrix: module access overrides per user/role/dept
    # Use raw SQL to avoid SQLAlchemy's _on_table_create firing CREATE TYPE
    # even when create_type=False is set (async Alembic context bug).
    conn.execute(sa.text("""
        CREATE TABLE IF NOT EXISTS permissions_matrix (
            id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            tenant_id   UUID NOT NULL,
            subject_type perm_subject_type NOT NULL,
            subject_id  UUID NOT NULL,
            module      VARCHAR(50) NOT NULL,
            access_level access_level_enum NOT NULL DEFAULT 'full',
            CONSTRAINT uq_permissions_matrix
                UNIQUE (tenant_id, subject_type, subject_id, module)
        )
    """))

    # RLS: same pattern as n4o5p6q7r8s9 — standard tenant_isolation policy
    for table in RBAC_TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"""
            CREATE POLICY tenant_isolation ON {table}
                USING     (tenant_id = app_tenant_id())
                WITH CHECK (tenant_id = app_tenant_id())
        """)
        op.execute(f"GRANT SELECT, INSERT, UPDATE, DELETE ON {table} TO app_user")


def downgrade() -> None:
    for table in reversed(RBAC_TABLES):
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")

    op.drop_table('permissions_matrix')
    op.drop_table('rbac_user_roles')
    op.drop_table('rbac_roles')

    op.get_bind().execute(sa.text("DROP TYPE IF EXISTS access_level_enum"))
    op.get_bind().execute(sa.text("DROP TYPE IF EXISTS perm_subject_type"))
