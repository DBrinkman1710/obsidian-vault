from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel

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


class InvoiceCreate(BaseModel):
    contact_id: uuid.UUID
    subscription_id: Optional[uuid.UUID] = None
    description: Optional[str] = None
    line_items: list[LineItem]
    tax_cents: int = 0
    currency: str = "EUR"
    due_date: Optional[date] = None
    status: InvoiceStatus = InvoiceStatus.pending


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
    due_date: Optional[date]
    paid_at: Optional[datetime]
    created_at: datetime

    model_config = {"from_attributes": True}


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
