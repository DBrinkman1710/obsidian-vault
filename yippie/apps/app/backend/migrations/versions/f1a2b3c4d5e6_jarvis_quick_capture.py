"""[JARVIS1] user_reminders table + users.jarvis_prefs

Revision ID: f1a2b3c4d5e6
Revises: sec1_rls_shipments
Create Date: 2026-06-30

Quick-capture assistant: personal reminders fired via WebSocket toast, plus a
per-user preferences blob (hotkey, enabled action types, default context mode).
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = 'f1a2b3c4d5e6'
down_revision: Union[str, None] = 'sec1_rls_shipments'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column('jarvis_prefs', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )

    op.create_table(
        'user_reminders',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('user_id', sa.UUID(), nullable=False),
        sa.Column('tenant_id', sa.UUID(), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('remind_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('dismissed_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(
        'ix_user_reminders_pending',
        'user_reminders',
        ['user_id', 'remind_at'],
        unique=False,
        postgresql_where=sa.text('dismissed_at IS NULL'),
    )

    op.execute("ALTER TABLE user_reminders ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE user_reminders FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON user_reminders")
    op.execute("""
        CREATE POLICY tenant_isolation ON user_reminders
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON user_reminders TO app_user")


def downgrade() -> None:
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON user_reminders")
    op.drop_index('ix_user_reminders_pending', table_name='user_reminders')
    op.drop_table('user_reminders')
    op.drop_column('users', 'jarvis_prefs')
