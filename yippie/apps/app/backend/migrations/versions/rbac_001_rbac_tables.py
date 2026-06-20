"""Add RBAC tables: rbac_roles, rbac_user_roles, permissions_matrix

Revision ID: rbac_001
Revises: 06a08e251d50, s9t0u1v2w3x4, dept_members_001, n4o5p6q7r8s9
Create Date: 2026-06-20

Merges all current heads and creates the three RBAC tables.
perm_subject_type and access_level_enum are created as named Postgres
enums (models use create_type=False, so the migration owns them).
"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'rbac_001'
down_revision: Union[str, Sequence[str], None] = (
    '06a08e251d50',
    's9t0u1v2w3x4',
    'dept_members_001',
    'n4o5p6q7r8s9',
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
    op.create_table(
        'rbac_roles',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True),
                  sa.ForeignKey('tenants.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True),
                  server_default=sa.text('now()')),
    )

    # rbac_user_roles: maps users to RBAC roles (many-to-many)
    op.create_table(
        'rbac_user_roles',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True),
                  sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role_id', UUID(as_uuid=True),
                  sa.ForeignKey('rbac_roles.id', ondelete='CASCADE'), nullable=False),
        sa.UniqueConstraint('user_id', 'role_id', name='uq_rbac_user_role'),
    )

    # permissions_matrix: module access overrides per user/role/dept
    op.create_table(
        'permissions_matrix',
        sa.Column('id', UUID(as_uuid=True), primary_key=True,
                  server_default=sa.text('gen_random_uuid()')),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('subject_type',
                  sa.Enum('user', 'role', 'department',
                           name='perm_subject_type', create_type=False),
                  nullable=False),
        sa.Column('subject_id', UUID(as_uuid=True), nullable=False),
        sa.Column('module', sa.String(50), nullable=False),
        sa.Column('access_level',
                  sa.Enum('full', 'view', 'restricted',
                           name='access_level_enum', create_type=False),
                  nullable=False, server_default='full'),
        sa.UniqueConstraint('tenant_id', 'subject_type', 'subject_id', 'module',
                            name='uq_permissions_matrix'),
    )

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
