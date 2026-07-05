"""[EML1] Linked Gmail/Outlook accounts — OAuth email transport (optional, Resend stays default)

Revision ID: eml1_email_accounts
Revises: m2_merge_email_ci_and_yip
Create Date: 2026-07-05
"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB, UUID

revision: str = 'eml1_email_accounts'
down_revision: Union[str, None] = 'm2_merge_email_ci_and_yip'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'email_accounts',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('tenant_id', UUID(as_uuid=True), nullable=False),
        # NULL user_id = tenant-level shared mailbox; set = agent's personal mailbox
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=True),
        sa.Column('provider', sa.String(20), nullable=False),  # 'gmail' | 'outlook'
        sa.Column('email_address', sa.String(255), nullable=False),
        sa.Column('display_name', sa.String(255), nullable=True),
        sa.Column('refresh_token_encrypted', sa.Text(), nullable=False),
        sa.Column('access_token_encrypted', sa.Text(), nullable=True),
        sa.Column('access_token_expires_at', sa.DateTime(timezone=True), nullable=True),
        # Space-joined scopes actually granted (Google can partially grant)
        sa.Column('scopes', sa.Text(), nullable=True),
        # gmail: {"history_id": "..."}; outlook: {"delta_link": "..."}
        sa.Column('sync_state', JSONB, nullable=True),
        sa.Column('last_synced_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('status', sa.String(20), nullable=False, server_default='active'),  # active | error | revoked
        sa.Column('last_error', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('tenant_id', 'email_address', name='uq_email_accounts_tenant_address'),
    )
    op.create_index('ix_email_accounts_tenant_user', 'email_accounts', ['tenant_id', 'user_id'])

    op.execute("ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE email_accounts FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON email_accounts")
    op.execute("""
        CREATE POLICY tenant_isolation ON email_accounts
            USING     (tenant_id = app_tenant_id())
            WITH CHECK (tenant_id = app_tenant_id())
    """)
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON email_accounts TO app_user")

    # Inbound messages ingested from a linked mailbox: provider_message_id is the
    # Gmail/Graph message id (dedupe, analogous to resend_email_id); smtp_message_id
    # is the RFC822 Message-ID header used for reply threading.
    op.add_column('inbound_messages', sa.Column('email_account_id', UUID(as_uuid=True), nullable=True))
    op.add_column('inbound_messages', sa.Column('provider_message_id', sa.String(255), nullable=True))
    op.add_column('inbound_messages', sa.Column('smtp_message_id', sa.Text(), nullable=True))
    op.create_index(
        'uq_inbound_messages_account_provider_msg',
        'inbound_messages',
        ['email_account_id', 'provider_message_id'],
        unique=True,
        postgresql_where=sa.text('provider_message_id IS NOT NULL'),
    )

    # Transport snapshot at queue time (same rationale as the from_email snapshot)
    op.add_column('pending_sends', sa.Column('email_account_id', UUID(as_uuid=True), nullable=True))

    # Which transport sent this email — the Resend status poller must skip
    # provider-sent mail (their ids are not Resend ids).
    op.add_column('outbound_emails', sa.Column('provider', sa.String(20), nullable=False, server_default='resend'))


def downgrade() -> None:
    op.drop_column('outbound_emails', 'provider')
    op.drop_column('pending_sends', 'email_account_id')
    op.drop_index('uq_inbound_messages_account_provider_msg', table_name='inbound_messages')
    op.drop_column('inbound_messages', 'smtp_message_id')
    op.drop_column('inbound_messages', 'provider_message_id')
    op.drop_column('inbound_messages', 'email_account_id')
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON email_accounts")
    op.drop_index('ix_email_accounts_tenant_user', table_name='email_accounts')
    op.drop_table('email_accounts')
