from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class SubscriptionStatus(str, enum.Enum):
    trial = "trial"
    active = "active"
    paused = "paused"
    cancelled = "cancelled"


class BillingCycle(str, enum.Enum):
    monthly = "monthly"
    annual = "annual"
    one_time = "one_time"


class InvoiceStatus(str, enum.Enum):
    draft = "draft"
    sent = "sent"
    paid = "paid"
    overdue = "overdue"
    void = "void"
    # BILLING2 UI statuses (Pending / Received / Not Sent)
    pending = "pending"
    received = "received"
    not_sent = "not_sent"


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False)
    plan_name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[SubscriptionStatus] = mapped_column(Enum(SubscriptionStatus), nullable=False, default=SubscriptionStatus.active)
    billing_cycle: Mapped[BillingCycle] = mapped_column(Enum(BillingCycle), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    next_billing_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    cancelled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Invoice(Base):
    __tablename__ = "invoices"
    # Invoice numbers are per-tenant sequences, so uniqueness is scoped to the tenant
    # (a global unique constraint would make two tenants' INV-0001 collide).
    __table_args__ = (UniqueConstraint("tenant_id", "invoice_number", name="uq_invoices_tenant_number"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    contact_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=False)
    subscription_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), ForeignKey("subscriptions.id"), nullable=True)
    # NULL until the invoice is issued — the number is claimed from the tenant's
    # counter at that moment so the issued series never gaps on a discarded draft.
    invoice_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    status: Mapped[InvoiceStatus] = mapped_column(Enum(InvoiceStatus), nullable=False, default=InvoiceStatus.draft)
    line_items: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    subtotal_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    tax_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    total_cents: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    invoice_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    due_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    payment_terms: Mapped[str | None] = mapped_column(Text, nullable=True)
    # BTW verlegd — intra EU B2B reverse charge. Legally distinct from a 0% rate
    # (which states an exemption), so it needs its own flag, not a magic rate.
    reverse_charge: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Set once, when the invoice is issued. The single source of truth for
    # immutability: NULL = draft, NOT NULL = locked (see service._assert_mutable).
    issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # A corrective document (creditfactuur) reversing the invoice it points at.
    credit_note_of_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoices.id", ondelete="SET NULL"), nullable=True
    )
    # Seller/client details as they read at issue time. The PDF renders from
    # these so reprinting years later reproduces the document that was sent,
    # not one rebuilt from today's tenant/contact rows.
    seller_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    client_snapshot: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    @property
    def is_issued(self) -> bool:
        return self.issued_at is not None
    # Per invoice layout override ([TMPL1]); falls back to the tenant default.
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("invoice_templates.id", ondelete="SET NULL"), nullable=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InvoiceTemplate(Base):
    """Drag and drop invoice layout + invoice defaults ([TMPL1]).

    blocks holds the structured JSON layout (app/core/doc_blocks.py); the
    default_* columns prefill new invoices (tax rate, due days, payment notes).
    At most one template per tenant carries is_default (partial unique index).
    """

    __tablename__ = "invoice_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    blocks: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=lambda: {"version": 1, "blocks": []}
    )
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    default_tax_rate_pct: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_due_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    default_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class InvoiceCounter(Base):
    """Per tenant invoice number sequence.

    Persistent and monotonic — deliberately not derived from a COUNT of rows, so
    deleting an invoice can never hand its number to a later one. Incremented by
    a single atomic UPSERT (see service._claim_invoice_number).
    """

    __tablename__ = "invoice_counters"

    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True)
    prefix: Mapped[str] = mapped_column(String(20), nullable=False, default="INV")
    last_number: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    invoice_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("invoices.id"), nullable=False)
    amount_cents: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")
    method: Mapped[str] = mapped_column(String(50), nullable=False)
    reference: Mapped[str | None] = mapped_column(Text, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
