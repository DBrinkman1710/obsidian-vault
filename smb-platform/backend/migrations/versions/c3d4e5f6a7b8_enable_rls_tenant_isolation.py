"""enable RLS tenant isolation on all tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-02 14:00:00.000000

asyncpg uses the PostgreSQL extended query protocol which requires
prepared statements.  Prepared statements cannot contain multiple SQL
commands, so every op.execute() call must contain exactly one statement.
"""
from typing import Sequence, Union
from alembic import op

revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

TABLES = [
    "contacts", "tickets", "ticket_comments", "response_templates",
    "subscriptions", "invoices", "payments", "activity_events",
    "inbound_messages", "draft_tickets", "departments",
    "chat_sessions", "chat_messages", "users",
]


def upgrade() -> None:
    # 1. Create app_user role (non-superuser — superusers bypass RLS)
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
                CREATE ROLE app_user NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
            END IF;
        END
        $$
    """)

    # 2. Grant app_user to the connecting role so SET ROLE works
    op.execute("""
        DO $$
        DECLARE connecting_role text := current_user;
        BEGIN
            EXECUTE format('GRANT app_user TO %I', connecting_role);
        END
        $$
    """)

    # 3. Table-level permissions for app_user
    op.execute("GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user")
    op.execute("GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user")

    # 4. Helper function — returns NULL when unset (missing_ok=true) so
    #    alembic/seed scripts without a tenant context see 0 rows, not errors
    op.execute("""
        CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid
            LANGUAGE sql STABLE
            AS $$ SELECT current_setting('app.current_tenant_id', true)::uuid; $$
    """)
    op.execute("GRANT EXECUTE ON FUNCTION app_tenant_id() TO app_user")

    # 5. tenants — SPECIAL CASE: PK `id` IS the tenant identifier
    op.execute("ALTER TABLE tenants ENABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenants FORCE ROW LEVEL SECURITY")
    op.execute("DROP POLICY IF EXISTS tenant_isolation ON tenants")
    op.execute("""
        CREATE POLICY tenant_isolation ON tenants
            USING     (id = app_tenant_id())
            WITH CHECK (id = app_tenant_id())
    """)

    # 6. All other tables — standard tenant_id column pattern
    for table in TABLES:
        op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY")
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"""
            CREATE POLICY tenant_isolation ON {table}
                USING     (tenant_id = app_tenant_id())
                WITH CHECK (tenant_id = app_tenant_id())
        """)


def downgrade() -> None:
    for table in TABLES:
        op.execute(f"DROP POLICY IF EXISTS tenant_isolation ON {table}")
        op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY")
        op.execute(f"ALTER TABLE {table} NO FORCE ROW LEVEL SECURITY")

    op.execute("DROP POLICY IF EXISTS tenant_isolation ON tenants")
    op.execute("ALTER TABLE tenants DISABLE ROW LEVEL SECURITY")
    op.execute("ALTER TABLE tenants NO FORCE ROW LEVEL SECURITY")
    op.execute("DROP FUNCTION IF EXISTS app_tenant_id()")
