"""tenant_cascade_all — cascade all tenant_id columns to tenants(id)

Every table that scopes data by tenant_id now carries a proper FK to
tenants(id) ON DELETE CASCADE. Deleting a tenant row lets PostgreSQL
cascade the wipe automatically, so application code no longer needs to
maintain a hand-rolled table order.

Revision ID: tenant_cascade_all
Revises: req1_booking_requests
Create Date: 2026-07-08
"""
from alembic import op

revision: str = "tenant_cascade_all"
down_revision: str = "req1_booking_requests"
branch_labels = None
depends_on = None

# Tables that need a NEW FK added (no FK to tenants(id) exists yet).
# Rows with dangling tenant_ids are purged first so the constraint validates.
_NEEDS_NEW_FK = [
    "activity_events",
    "assistant_memories",
    "booking_requests",
    "calendar_event_invitations",
    "calendar_events",
    "campaign_analytics",
    "campaign_sequences",
    "campaign_templates",
    "campaigns",
    "chat_messages",
    "chat_sessions",
    "contact_bounces",
    "contact_labels",
    "contact_pipeline_entries",
    "contact_unsubscribes",
    "contacts",
    "contract_templates",
    "contracts",
    "departments",
    "draft_tickets",
    "email_accounts",
    "external_calendar_events",
    "external_calendar_feeds",
    "flow_events",
    "flow_pending_steps",
    "flow_runs",
    "flows",
    "inbound_messages",
    "invoices",
    "jarvis_messages",
    "jarvis_threads",
    "label_click_tokens",
    "outbound_emails",
    "payments",
    "pending_sends",
    "permissions_matrix",
    "pipeline_stages",
    "rbac_user_roles",
    "response_templates",
    "saas_events",
    "saas_health",
    "saas_identity",
    "shipment_events",
    "shipments",
    "subscriptions",
    "ticket_comments",
    "tickets",
    "user_reminders",
    "worker_availability",
    "worker_availability_exceptions",
]


def upgrade() -> None:
    # Step 1 — purge any orphaned rows (tenant_id pointing to a deleted tenant).
    # These can exist if a previous delete ran before CASCADE was in place.
    # Wrap in a single DO block to keep the purge atomic and fast.
    purge_cases = "\n".join(
        f"    EXECUTE format('DELETE FROM %I WHERE tenant_id NOT IN (SELECT id FROM tenants)', '{t}');"
        for t in _NEEDS_NEW_FK
    )
    op.execute(f"""
DO $$
BEGIN
{purge_cases}
END $$;
""")

    # Step 2 — upgrade existing FKs that point to tenants(id) without CASCADE.
    # Finds them dynamically so we don't need to hard-code constraint names.
    op.execute("""
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN (
        SELECT kcu.table_name, tc.constraint_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
             ON  tc.constraint_name  = kcu.constraint_name
             AND tc.table_schema     = kcu.table_schema
        JOIN information_schema.referential_constraints rc
             ON  tc.constraint_name  = rc.constraint_name
             AND tc.table_schema     = rc.constraint_schema
        JOIN information_schema.table_constraints tc2
             ON  rc.unique_constraint_name   = tc2.constraint_name
             AND rc.unique_constraint_schema = tc2.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc2.table_name     = 'tenants'
          AND kcu.column_name    = 'tenant_id'
          AND rc.delete_rule    != 'CASCADE'
          AND tc.table_schema    = 'public'
    )
    LOOP
        EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I',
                       r.table_name, r.constraint_name);
        EXECUTE format(
            'ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE',
            r.table_name, r.constraint_name);
    END LOOP;
END $$;
""")

    # Step 3 — add FK to tenants for tables that have no FK at all yet.
    for table in _NEEDS_NEW_FK:
        op.execute(
            f"ALTER TABLE {table} "
            f"ADD CONSTRAINT {table}_tenant_fk "
            f"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"
        )


def downgrade() -> None:
    for table in _NEEDS_NEW_FK:
        op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {table}_tenant_fk")
