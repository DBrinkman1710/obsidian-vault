"""department members

Revision ID: dept_members_001
Revises: livechat_status_001
Create Date: 2026-06-18

Adds the department_members join table — which users belong to which
departments — backing the dept inbox auto-routing + per-dept inbox views.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID


revision: str = 'dept_members_001'
down_revision: Union[str, None] = 'livechat_status_001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'department_members',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('department_id', UUID(as_uuid=True), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), nullable=False),
        sa.ForeignKeyConstraint(['tenant_id'], ['tenants.id']),
        sa.ForeignKeyConstraint(['department_id'], ['departments.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.UniqueConstraint('department_id', 'user_id', name='uq_department_members_dept_user'),
    )
    op.create_index(
        'ix_department_members_tenant_dept',
        'department_members',
        ['tenant_id', 'department_id'],
    )
    op.create_index(
        'ix_department_members_tenant_user',
        'department_members',
        ['tenant_id', 'user_id'],
    )

    # RLS: tables are FORCE row-level-secured in this DB; mirror the standard
    # tenant_isolation policy so app_user can read/write its own tenant's rows.
    op.execute("ALTER TABLE department_members ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE department_members FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON department_members")
    op.execute("""
        CREATE POLICY tenant_isolation ON department_members
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON department_members TO app_user")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON department_members")
    op.drop_index('ix_department_members_tenant_user', table_name='department_members')
    op.drop_index('ix_department_members_tenant_dept', table_name='department_members')
    op.drop_table('department_members')
