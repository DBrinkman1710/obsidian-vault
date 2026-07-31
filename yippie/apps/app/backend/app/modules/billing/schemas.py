from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel, Field, field_validator

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


# The only VAT rates a Dutch invoice may carry: 21% general, 9% reduced,
# 0% exempt/intra EU. A foreign rate here would silently produce a wrong
# BTW aangifte, so it is rejected at the edge.
DUTCH_VAT_RATES = (0, 9, 21)


class LineItem(BaseModel):
    description: str
    quantity: int
    unit_price_cents: int
    tax_rate_pct: int = 21

    @field_validator("tax_rate_pct")
    @classmethod
    def _dutch_rate_only(cls, v: int) -> int:
        if v not in DUTCH_VAT_RATES:
            raise ValueError(
                f"BTW rate must be one of {', '.join(f'{r}%' for r in DUTCH_VAT_RATES)}; got {v}%"
            )
        return v


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
    payment_terms: Optional[str] = None
    # BTW verlegd — forces every line to 0% and prints the statement on the PDF.
    reverse_charge: bool = False
    status: InvoiceStatus = InvoiceStatus.pending
    # Layout override ([TMPL1]); when omitted the tenant default template applies.
    template_id: Optional[uuid.UUID] = None


class InvoiceUpdate(BaseModel):
    """Draft edits. Everything describing the document is refused once the
    invoice is issued (see service._assert_mutable); only status survives."""

    status: Optional[InvoiceStatus] = None
    notes: Optional[str] = None
    due_date: Optional[date] = None
    invoice_date: Optional[date] = None
    line_items: Optional[list[LineItem]] = None
    payment_terms: Optional[str] = None
    reverse_charge: Optional[bool] = None


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
    # None while the invoice is still a draft — a number is claimed at issue.
    invoice_number: Optional[str] = None
    status: InvoiceStatus
    line_items: list
    subtotal_cents: int
    tax_cents: int
    total_cents: int
    currency: str
    invoice_date: Optional[date] = None
    due_date: Optional[date]
    notes: Optional[str] = None
    payment_terms: Optional[str] = None
    reverse_charge: bool = False
    template_id: Optional[uuid.UUID] = None
    paid_at: Optional[datetime]
    created_at: datetime
    # Set once the invoice is legally issued; from then on it is read only.
    issued_at: Optional[datetime] = None
    is_issued: bool = False
    credit_note_of_id: Optional[uuid.UUID] = None
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
