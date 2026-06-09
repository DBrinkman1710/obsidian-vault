"""grant app_user privileges on pending_sends + set default privileges for future tables

The RLS migration (c3d4e5f6a7b8) ran `GRANT ... ON ALL TABLES IN SCHEMA public
TO app_user`, which only covers tables that existed at that moment. pending_sends
was created later (b8c9d0e1f2a3) and was never granted, so every send-reply
request fails with `permission denied for table pending_sends` once the app
switches to the restricted app_user role. This grants it explicitly and adds
ALTER DEFAULT PRIVILEGES so any table created later by the migration role is
automatically granted to app_user too.

Revision ID: c9d0e1f2a3b4
Revises: b8c9d0e1f2a3
Create Date: 2026-06-08

"""
from typing import Sequence, Union
from alembic import op


revision: str = 'c9d0e1f2a3b4'
down_revision: Union[str, None] = 'b8c9d0e1f2a3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON pending_sends TO app_user")
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user")
    op.execute("""
        DO $$
        DECLARE connecting_role text := current_user;
        BEGIN
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
                 GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user',
                connecting_role
            );
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
                 GRANT USAGE, SELECT ON SEQUENCES TO app_user',
                connecting_role
            );
        END
        $$
    """)


def downgrade() -> None:
    op.execute("""
        DO $$
        DECLARE connecting_role text := current_user;
        BEGIN
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
                 REVOKE USAGE, SELECT ON SEQUENCES FROM app_user',
                connecting_role
            );
            EXECUTE format(
                'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public
                 REVOKE SELECT, INSERT, UPDATE, DELETE ON TABLES FROM app_user',
                connecting_role
            );
        END
        $$
    """)
    op.execute("REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM app_user")
    op.execute("REVOKE SELECT, INSERT, UPDATE, DELETE ON pending_sends FROM app_user")
