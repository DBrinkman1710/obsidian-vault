from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint, text
from sqlalchemy.dialects.postgresql import ARRAY, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.config import ALL_MODULES
from app.database import Base


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    admin = "admin"
    agent = "agent"
    viewer = "viewer"


class AccessLevel(str, enum.Enum):
    full = "full"
    view = "view"
    restricted = "restricted"


class PermSubjectType(str, enum.Enum):
    user = "user"
    role = "role"
    department = "department"


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled_modules: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=lambda: list(ALL_MODULES)
    )
    primary_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#5BB8E8")
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    # SaaS plan tier for this tenant's own Yippie subscription. Plans govern
    # user/contact limits; modules are à la carte add-ons (see app.core.plans).
    # Stored as the PlanTier value string; new tenants default to the founder tier.
    plan: Mapped[str] = mapped_column(String(20), nullable=False, server_default="founder")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # When set, the hourly demo_expiry_check job deactivates the tenant after this time.
    # Superadmins can extend it from the client detail modal.
    demo_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    demo_nudge_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    go_live_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    inbound_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Dutch legal registration numbers — shown on invoices/exports.
    # KvK = Chamber of Commerce number; Btw = VAT number.
    kvk_nummer: Mapped[str | None] = mapped_column(String(100), nullable=True)
    btw_nummer: Mapped[str | None] = mapped_column(String(100), nullable=True)
    # Invoice sender address — printed on PDF invoices.
    street_address: Mapped[str | None] = mapped_column(String(255), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    city: Mapped[str | None] = mapped_column(String(100), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True, server_default="Nederland")
    iban: Mapped[str | None] = mapped_column(String(34), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Ticket deadline indicator thresholds (Sidebar dot on the Tickets nav).
    # Red = overdue or due within deadline_red_days; orange = due within deadline_orange_days.
    deadline_red_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="1")
    deadline_orange_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="2")
    # Auto-close stale tickets in "waiting" status after this many days without an
    # update. Per-tenant; the hourly scheduler job reads it (see sla_escalation.py).
    auto_close_days: Mapped[int] = mapped_column(Integer, nullable=False, server_default="7")
    # Solved live-chat sessions drop off the active list after this many hours.
    # Display filter only — messages are retained permanently.
    hide_solved_chats_hours: Mapped[int] = mapped_column(Integer, nullable=False, server_default="72")
    # Tracks which onboarding drip emails have been sent: e.g. ["day3", "day7"].
    onboarding_drip_sent: Mapped[list | None] = mapped_column(JSONB, nullable=True, server_default="[]")
    # When False (default) the inbox AI never runs automatically — agents click the
    # Generate button per draft. Set True to restore the old auto-scan-on-arrival
    # behaviour (background enrich_queued_drafts job). Editable via superadmin modal.
    ai_auto_scan: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    # WhatsApp Business (Meta Cloud API) credentials — set per tenant via superadmin edit modal
    whatsapp_phone_number_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    whatsapp_access_token: Mapped[str | None] = mapped_column(Text, nullable=True)
    whatsapp_verify_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Resend custom sending domain — provisioned via superadmin and verified by the client adding DNS records.
    # resend_domain_records holds the list of DNS records returned by the Resend API (SPF, DKIM, …).
    resend_domain_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    resend_domain_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resend_domain_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    resend_domain_records: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Stripe SaaS billing — Layer 1 (Yippie charges this tenant).
    stripe_customer_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stripe_subscription_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    stripe_subscription_status: Mapped[str | None] = mapped_column(String(50), nullable=True)
    stripe_price_ids: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # When set, the hourly subscription_expiry_check job deactivates the tenant after this time.
    # Populated from Stripe's current_period_end on subscription cancellation.
    subscription_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Rolling AI scan counter — reset to 0 at the start of each billing period.
    ai_scans_used_this_period: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    ai_scans_period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # AI profile — set via the Yip training conversation or Settings → AI & Yip.
    # Keys: business_description, tone, reply_language, sign_off, common_terms, faq_context
    ai_profile: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Sendcloud shipping integration — public key + secret key per tenant.
    # Secret is used for HMAC webhook verification; never returned raw to the frontend.
    sendcloud_api_key: Mapped[str | None] = mapped_column(Text, nullable=True)
    sendcloud_api_secret: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Generic ERP order webhook — ERPs push order/tracking updates to /webhooks/orders/{slug}.
    # If set, the X-Api-Key header must match; if unset, all requests are accepted (easy onboarding).
    orders_webhook_secret: Mapped[str | None] = mapped_column(String(100), nullable=True)
    whatsapp_webhook_secret: Mapped[str] = mapped_column(String(100), nullable=False, server_default="")
    # JS snippet auth token for SALES-MOD1 / SAAS-MOD1 ingest. Stable per tenant;
    # rotatable via POST /sales/token/rotate if compromised.
    tracking_token: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, unique=True, default=uuid.uuid4)
    # Lead capture widget config — controls whether the public embed widget saves contacts
    # and which pipeline stage they land in.
    lead_widget_save_contact: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    lead_widget_stage_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    # Order system webhook → pipeline stage mapping.
    # When an ERP/Shopify order arrives, the contact's kanban card is moved to the
    # configured stage for that order status event.
    order_placed_stage_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    order_shipped_stage_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    order_delivered_stage_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list[User]] = relationship("User", back_populates="tenant")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.agent)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reply_from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Personal Yippie receiving address on the Resend domain (e.g. klimaatexamen-eddy@getyippie.com).
    # Mail forwarded here lands in this user's personal inbox instead of the tenant's shared one.
    inbound_email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    # Personal signature appended to compose/reply (plain text; rendered into the HTML layout on send)
    email_signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Per-user toggle for keyboard shortcuts (e.g. Cmd/Ctrl+Enter to send). Off = no hotkeys fire.
    hotkeys_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    shared_inbox_disabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    # Per-user Contacts table column config: [{key, label, visible, order}, ...]
    contact_column_prefs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Per-user sidebar module order: list of module key strings (e.g. ["inbox", "tickets", ...])
    sidebar_order: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # Extra "From" addresses for compose/reply beyond the single reply_from_email.
    send_from_aliases: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    # True once the user has dismissed the first-login guided tour.
    tour_completed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    # True once the user has dismissed the post-tour setup checklist widget.
    setup_checklist_dismissed: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    ui_language: Mapped[str] = mapped_column(String(10), nullable=False, server_default="en")
    # Per-user toggle for contextual ? help tips shown throughout the app.
    help_tips_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    # Quick-capture (Jarvis) preferences: {hotkey, enabled_actions, default_context_mode}.
    jarvis_prefs: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Opaque token for the personal iCal export feed (/public/calendar/{token}.ics).
    calendar_feed_token: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, server_default=text("gen_random_uuid()"))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant: Mapped[Tenant] = relationship("Tenant", back_populates="users")
    signatures: Mapped[list[UserSignature]] = relationship(
        "UserSignature", back_populates="user", cascade="all, delete-orphan"
    )


class UserSignature(Base):
    """A named, reorderable email signature owned by a single user (S1/S2).

    Replaces the single User.email_signature column with a list. The legacy
    column is retained for backward compat and backfilled into a "Default" row.
    The body is plain text but may embed a single base64 data-URI <img> tag
    (S2 image upload); the send path renders that image through the HTML layout.
    """

    __tablename__ = "user_signatures"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    # tenant_id is carried directly so the standard RLS tenant_isolation policy applies.
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, server_default="")
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="false")
    display_order: Mapped[int] = mapped_column(Integer, nullable=False, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    user: Mapped[User] = relationship("User", back_populates="signatures")


class UserReminder(Base):
    """A personal Jarvis reminder; the minute-job fires a WebSocket toast at remind_at."""

    __tablename__ = "user_reminders"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    remind_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    dismissed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AssistantMemory(Base):
    """A durable fact Yip remembers about a user (saved via the save_memory tool)."""

    __tablename__ = "assistant_memories"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RbacRole(Base):
    __tablename__ = "rbac_roles"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class RbacUserRole(Base):
    __tablename__ = "rbac_user_roles"
    __table_args__ = (UniqueConstraint("user_id", "role_id"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("rbac_roles.id", ondelete="CASCADE"), nullable=False)


class PermissionsMatrix(Base):
    __tablename__ = "permissions_matrix"
    __table_args__ = (UniqueConstraint("tenant_id", "subject_type", "subject_id", "module"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    subject_type: Mapped[PermSubjectType] = mapped_column(
        Enum(PermSubjectType, name="perm_subject_type", create_type=False), nullable=False
    )
    subject_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    module: Mapped[str] = mapped_column(String(50), nullable=False)
    access_level: Mapped[AccessLevel] = mapped_column(
        Enum(AccessLevel, name="access_level_enum", create_type=False), nullable=False, default=AccessLevel.full
    )
