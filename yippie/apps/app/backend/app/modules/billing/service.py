from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.billing.models import Invoice, InvoiceStatus, Payment, Subscription
from app.modules.billing.schemas import InvoiceCreate, PaymentCreate, SubscriptionCreate


class PaymentError(ValueError):
    """Raised when a payment cannot be applied to an invoice."""


async def _next_invoice_number(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    # Serialise numbering per-tenant for the rest of this transaction so concurrent
    # invoice creation can't hand out duplicate numbers.
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"),
        {"k": f"invoice:{tenant_id}"},
    )
    count = await db.scalar(
        select(func.count(Invoice.id)).where(Invoice.tenant_id == tenant_id)
    )
    return f"INV-{(count or 0) + 1:04d}"


async def create_subscription(
    db: AsyncSession, tenant_id: uuid.UUID, data: SubscriptionCreate
) -> Subscription:
    sub = Subscription(tenant_id=tenant_id, **data.model_dump())
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return sub


async def list_subscriptions(db: AsyncSession, tenant_id: uuid.UUID) -> list[Subscription]:
    result = await db.execute(select(Subscription).where(Subscription.tenant_id == tenant_id))
    return result.scalars().all()


async def create_invoice(
    db: AsyncSession, tenant_id: uuid.UUID, data: InvoiceCreate
) -> Invoice:
    subtotal = sum(item.quantity * item.unit_price_cents for item in data.line_items)
    invoice = Invoice(
        tenant_id=tenant_id,
        invoice_number=await _next_invoice_number(db, tenant_id),
        subtotal_cents=subtotal,
        total_cents=subtotal + data.tax_cents,
        line_items=[item.model_dump() for item in data.line_items],
        contact_id=data.contact_id,
        subscription_id=data.subscription_id,
        tax_cents=data.tax_cents,
        currency=data.currency,
        due_date=data.due_date,
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    return invoice


async def list_invoices(
    db: AsyncSession, tenant_id: uuid.UUID, contact_id: Optional[uuid.UUID] = None
) -> list[Invoice]:
    q = select(Invoice).where(Invoice.tenant_id == tenant_id)
    if contact_id:
        q = q.where(Invoice.contact_id == contact_id)
    result = await db.execute(q.order_by(Invoice.created_at.desc()))
    return result.scalars().all()


async def get_invoice(db: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> Optional[Invoice]:
    result = await db.execute(
        select(Invoice).where(Invoice.tenant_id == tenant_id, Invoice.id == invoice_id)
    )
    return result.scalar_one_or_none()


async def record_payment(
    db: AsyncSession, tenant_id: uuid.UUID, invoice: Invoice, data: PaymentCreate
) -> Payment:
    if invoice.status == InvoiceStatus.void:
        raise PaymentError("Cannot record a payment against a void invoice.")
    if data.amount_cents <= 0:
        raise PaymentError("Payment amount must be positive.")

    payment = Payment(
        tenant_id=tenant_id,
        invoice_id=invoice.id,
        currency=invoice.currency,
        **data.model_dump(),
    )
    db.add(payment)

    # Mark paid only once the cumulative paid amount covers the invoice total.
    paid_so_far = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(Payment.invoice_id == invoice.id)
    )
    if (paid_so_far or 0) + data.amount_cents >= invoice.total_cents and invoice.status != InvoiceStatus.paid:
        invoice.status = InvoiceStatus.paid
        invoice.paid_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(payment)
    return payment
