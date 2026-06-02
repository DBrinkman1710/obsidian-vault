"""enable RLS tenant isolation on all tables

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-06-02 14:00:00.000000

Security notes
--------------
* app_user is NOT a superuser — superusers bypass RLS silently.
* Policies use current_setting('app.current_tenant_id', true) with
  the `true` (missing_ok) flag so migrations/seeds that run without
  a tenant context return NULL and no rows rather than raising an error.
* set_tenant_context() sets both app.current_tenant_id AND
  SET LOCAL ROLE app_user so every app transaction runs as a
  non-superuser and is therefore subject to RLS.
* tenants table is a special case: the PK `id` IS the tenant
  identifier, so the policy uses id = app_tenant_id().
"""
from typing import Sequence, Union
from alembic import op


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("""
-- ─────────────────────────────────────────────────────────────────────────────
-- 1. NON-SUPERUSER APPLICATION ROLE
--    IMPORTANT: do NOT add SUPERUSER or BYPASSRLS — either silently disables RLS.
-- ─────────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
        CREATE ROLE app_user NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
    END IF;
END
$$;

-- Grant the application role to the connecting superuser so SET ROLE works.
DO $$
DECLARE
    connecting_role text := current_user;
BEGIN
    EXECUTE format('GRANT app_user TO %I', connecting_role);
END
$$;

-- Table access for app_user (RLS still applies — these are the max allowed rows).
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. HELPER FUNCTION — avoids repeating the cast everywhere
--    Returns NULL when setting is unset (missing_ok = true), so alembic and
--    seed scripts that run without a tenant context see 0 rows and don't error.
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION app_tenant_id() RETURNS uuid
    LANGUAGE sql STABLE
    AS $$ SELECT current_setting('app.current_tenant_id', true)::uuid; $$;

GRANT EXECUTE ON FUNCTION app_tenant_id() TO app_user;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ENABLE RLS + POLICIES
--
--    Standard pattern for tables with tenant_id:
--      USING    (tenant_id = app_tenant_id())   — SELECT / DELETE filter
--      WITH CHECK (tenant_id = app_tenant_id()) — INSERT / UPDATE guard
--
--    FORCE ROW LEVEL SECURITY applies the policy to the table owner too
--    (not to superusers — that is handled by SET LOCAL ROLE app_user
--    in set_tenant_context()).
-- ─────────────────────────────────────────────────────────────────────────────

-- tenants ─────────────────────────────────────────────────────────────────────
-- SPECIAL CASE: PK `id` IS the tenant identifier — no tenant_id column.
-- A tenant may only read/write their own row.
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE tenants FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tenants;
CREATE POLICY tenant_isolation ON tenants
    USING     (id = app_tenant_id())
    WITH CHECK (id = app_tenant_id());

-- users ───────────────────────────────────────────────────────────────────────
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE users FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON users;
CREATE POLICY tenant_isolation ON users
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- contacts ────────────────────────────────────────────────────────────────────
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON contacts;
CREATE POLICY tenant_isolation ON contacts
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- tickets ─────────────────────────────────────────────────────────────────────
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON tickets;
CREATE POLICY tenant_isolation ON tickets
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- ticket_comments ─────────────────────────────────────────────────────────────
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON ticket_comments;
CREATE POLICY tenant_isolation ON ticket_comments
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- response_templates ──────────────────────────────────────────────────────────
ALTER TABLE response_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_templates FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON response_templates;
CREATE POLICY tenant_isolation ON response_templates
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- subscriptions ───────────────────────────────────────────────────────────────
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON subscriptions;
CREATE POLICY tenant_isolation ON subscriptions
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- invoices ────────────────────────────────────────────────────────────────────
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON invoices;
CREATE POLICY tenant_isolation ON invoices
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- payments ────────────────────────────────────────────────────────────────────
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON payments;
CREATE POLICY tenant_isolation ON payments
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- activity_events ─────────────────────────────────────────────────────────────
ALTER TABLE activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_events FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON activity_events;
CREATE POLICY tenant_isolation ON activity_events
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- inbound_messages ────────────────────────────────────────────────────────────
ALTER TABLE inbound_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE inbound_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON inbound_messages;
CREATE POLICY tenant_isolation ON inbound_messages
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- draft_tickets ───────────────────────────────────────────────────────────────
ALTER TABLE draft_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE draft_tickets FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON draft_tickets;
CREATE POLICY tenant_isolation ON draft_tickets
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- departments ─────────────────────────────────────────────────────────────────
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON departments;
CREATE POLICY tenant_isolation ON departments
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- chat_sessions ───────────────────────────────────────────────────────────────
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON chat_sessions;
CREATE POLICY tenant_isolation ON chat_sessions
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- chat_messages ───────────────────────────────────────────────────────────────
-- No join-table indirection needed: chat_messages.tenant_id is denormalised
-- onto every row, so the standard pattern applies directly.
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation ON chat_messages;
CREATE POLICY tenant_isolation ON chat_messages
    USING     (tenant_id = app_tenant_id())
    WITH CHECK (tenant_id = app_tenant_id());

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VERIFICATION QUERIES
--    Run these manually (as app_user with a specific tenant set) to confirm
--    cross-tenant data is not visible.
--
--    SET LOCAL "app.current_tenant_id" = '<tenant-a-uuid>';
--    SET LOCAL ROLE app_user;
--    SELECT count(*) FROM tickets;           -- must return 0 for tenant-b rows
--    SELECT count(*) FROM tenants;           -- must return 1 (own row only)
--    SELECT count(*) FROM users;             -- own tenant users only
--    SELECT count(*) FROM contacts;
--    SELECT count(*) FROM subscriptions;
--    SELECT count(*) FROM invoices;
--    SELECT count(*) FROM payments;
--    SELECT count(*) FROM draft_tickets;
--    SELECT count(*) FROM chat_sessions;
--    SELECT count(*) FROM chat_messages;
--    SELECT count(*) FROM departments;
--    SELECT count(*) FROM activity_events;
-- ─────────────────────────────────────────────────────────────────────────────
""")


def downgrade() -> None:
    op.execute("""
-- Remove policies and disable RLS (does not drop the app_user role)
DO $$ DECLARE t text; BEGIN
    FOR t IN SELECT tablename FROM pg_tables
             WHERE schemaname = 'public'
               AND tablename IN (
                 'tenants','users','contacts','tickets','ticket_comments',
                 'response_templates','subscriptions','invoices','payments',
                 'activity_events','inbound_messages','draft_tickets',
                 'departments','chat_sessions','chat_messages'
               )
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', t);
        EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
        EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    END LOOP;
END $$;

DROP FUNCTION IF EXISTS app_tenant_id();
""")
