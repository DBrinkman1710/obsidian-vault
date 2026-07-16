from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field

from app.modules.billing.models import BillingCycle, InvoiceStatus, SubscriptionStatus


class SubscriptionCreate(BaseModel):
    contact_id: uuid.UUID
    plan_name: str
    billing_cycle: BillingCycle
    amount_cents: int
    currency: str = "EUR"


class SubscriptionOut(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    plan_name: str
    status: SubscriptionStatus
    billing_cycle: BillingCycle
    amount_cents: int
    currency: str
    started_at: datetime
    next_billing_at: Optional[datetime]

    model_config = {"from_attributes": True}


class LineItem(BaseModel):
    description: str
    quantity: int
    unit_price_cents: int
    tax_rate_pct: int = 21  # Dutch VAT rates: 0, 9, 21


class InvoiceCreate(BaseModel):
    contact_id: uuid.UUID
    subscription_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    line_items: list[LineItem]
    # tax_cents removed — computed automatically from per-line tax_rate_pct
    currency: str = "EUR"
    invoice_date: Optional[date] = None
    due_date: Optional[date] = None
    notes: Optional[str] = None
    status: InvoiceStatus = InvoiceStatus.pending
    # Layout override ([TMPL1]); when omitted the tenant default template applies.
    template_id: Optional[uuid.UUID] = None


class InvoiceUpdate(BaseModel):
    status: Optional[InvoiceStatus] = None
    notes: Optional[str] = None
    due_date: Optional[date] = None
    invoice_date: Optional[date] = None


class VatBreakdownLine(BaseModel):
    rate_pct: int
    subtotal_cents: int
    vat_cents: int


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID]


class InvoiceOut(BaseModel):
    id: uuid.UUID
    contact_id: uuid.UUID
    contact_name: Optional[str] = None
    invoice_number: str
    status: InvoiceStatus
    line_items: list
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    currency: str
    invoice_date: Optional[date] = None
    due_date: Optional[date]
    notes: Optional[str] = None
    template_id: Optional[uuid.UUID] = None
    paid_at: Optional[datetime]
    created_at: datetime
    vat_breakdown: list[VatBreakdownLine] = []

    model_config = {"from_attributes": True}


# ── Invoice templates ([TMPL1]) ────────────────────────────────────────────────


class InvoiceTemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    blocks: Optional[dict] = None
    default_tax_rate_pct: Optional[int] = Field(None, ge=0, le=100)
    default_due_days: Optional[int] = Field(None, ge=0, le=365)
    default_notes: Optional[str] = None


class InvoiceTemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    blocks: Optional[dict] = None
    default_tax_rate_pct: Optional[int] = Field(None, ge=0, le=100)
    default_due_days: Optional[int] = Field(None, ge=0, le=365)
    default_notes: Optional[str] = None


class InvoiceTemplateOut(BaseModel):
    id: uuid.UUID
    name: str
    blocks: dict
    schema_version: int = 1
    default_tax_rate_pct: Optional[int] = None
    default_due_days: Optional[int] = None
    default_notes: Optional[str] = None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class InvoiceTemplatePreviewRequest(BaseModel):
    """Unsaved blocks → sample invoice PDF, so the builder can preview before saving."""

    blocks: dict
    default_notes: Optional[str] = None


class ImportRow(BaseModel):
    row: int
    reason: str


class InvoiceImportResult(BaseModel):
    imported: int
    skipped: int
    errors: list[ImportRow]


class PaymentCreate(BaseModel):
    amount_cents: int
    method: str
    reference: Optional[str] = None


class PaymentOut(BaseModel):
    id: uuid.UUID
    invoice_id: uuid.UUID
    amount_cents: int
    currency: str
    method: str
    reference: Optional[str]
    paid_at: datetime

    model_config = {"from_attributes": True}
