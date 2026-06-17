from __future__ import annotations

import csv
import io
import uuid
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant
from app.modules.billing.models import Invoice, InvoiceStatus, Payment, Subscription
from app.modules.billing.schemas import ImportRow, InvoiceCreate, InvoiceImportResult, PaymentCreate, SubscriptionCreate
from app.modules.contacts.models import Contact


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
        status=data.status,
    )
    # The optional free-text description is stored as the first line item when no
    # explicit line items carry it (the Invoice model has no description column).
    if data.description and not invoice.line_items:
        invoice.line_items = [{"description": data.description, "quantity": 1, "unit_price_cents": 0}]
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    invoice.contact_name = await _contact_name(db, tenant_id, invoice.contact_id)
    return invoice


async def _contact_name(db: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID) -> Optional[str]:
    return await db.scalar(
        select(Contact.full_name).where(
            Contact.id == contact_id, Contact.tenant_id == tenant_id
        )
    )


async def list_invoices(
    db: AsyncSession, tenant_id: uuid.UUID, contact_id: Optional[uuid.UUID] = None
) -> list[Invoice]:
    # Left-join contacts so each invoice carries the contact's display name.
    q = (
        select(Invoice, Contact.full_name)
        .outerjoin(Contact, Contact.id == Invoice.contact_id)
        .where(Invoice.tenant_id == tenant_id)
    )
    if contact_id:
        q = q.where(Invoice.contact_id == contact_id)
    result = await db.execute(q.order_by(Invoice.created_at.desc()))
    invoices: list[Invoice] = []
    for invoice, contact_name in result.all():
        invoice.contact_name = contact_name
        invoices.append(invoice)
    return invoices


async def bulk_delete_invoices(
    db: AsyncSession, tenant_id: uuid.UUID, ids: list[uuid.UUID]
) -> int:
    """Delete invoices (and their payments) by id, scoped to the tenant."""
    if not ids:
        return 0
    # Remove dependent payments first to satisfy the FK constraint.
    await db.execute(
        delete(Payment).where(Payment.tenant_id == tenant_id, Payment.invoice_id.in_(ids))
    )
    result = await db.execute(
        delete(Invoice).where(Invoice.tenant_id == tenant_id, Invoice.id.in_(ids))
    )
    await db.commit()
    return result.rowcount or 0


async def export_invoices(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    ids: Optional[list[uuid.UUID]] = None,
    fmt: str = "csv",
) -> tuple[bytes, str, str]:
    """Export invoices as CSV or XLSX.

    Returns (content_bytes, media_type, filename). Falls back to CSV when
    XLSX is requested but openpyxl is unavailable.
    """
    q = (
        select(Invoice, Contact.full_name)
        .outerjoin(Contact, Contact.id == Invoice.contact_id)
        .where(Invoice.tenant_id == tenant_id)
    )
    if ids:
        q = q.where(Invoice.id.in_(ids))
    result = await db.execute(q.order_by(Invoice.created_at.desc()))
    rows = result.all()

    tenant = await db.get(Tenant, tenant_id)
    kvk = (tenant.kvk_nummer if tenant else None) or ""
    btw = (tenant.btw_nummer if tenant else None) or ""

    header = ["Invoice #", "Contact", "Status", "Total", "Currency", "Due Date", "Created At"]

    def _row(invoice: Invoice, contact_name: Optional[str]) -> list:
        return [
            invoice.invoice_number,
            contact_name or "",
            invoice.status.value if hasattr(invoice.status, "value") else str(invoice.status),
            f"{invoice.total_cents / 100:.2f}",
            invoice.currency,
            invoice.due_date.isoformat() if invoice.due_date else "",
            invoice.created_at.isoformat() if invoice.created_at else "",
        ]

    if fmt == "xlsx":
        try:
            from openpyxl import Workbook
        except ImportError:
            fmt = "csv"  # graceful fallback
        else:
            wb = Workbook()
            ws = wb.active
            ws.title = "Invoices"
            ws.append([f"# KvK: {kvk}"])
            ws.append([f"# BTW: {btw}"])
            ws.append(header)
            for invoice, contact_name in rows:
                ws.append(_row(invoice, contact_name))
            buf = io.BytesIO()
            wb.save(buf)
            return (
                buf.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "invoices.xlsx",
            )

    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow([f"# KvK: {kvk}"])
    writer.writerow([f"# BTW: {btw}"])
    writer.writerow(header)
    for invoice, contact_name in rows:
        writer.writerow(_row(invoice, contact_name))
    return buf.getvalue().encode("utf-8-sig"), "text/csv", "invoices.csv"


_STATUS_ALIASES: dict[str, InvoiceStatus] = {
    "pending": InvoiceStatus.pending,
    "received": InvoiceStatus.received,
    "not_sent": InvoiceStatus.not_sent,
    "not sent": InvoiceStatus.not_sent,
    "draft": InvoiceStatus.draft,
    "sent": InvoiceStatus.sent,
    "paid": InvoiceStatus.paid,
    "overdue": InvoiceStatus.overdue,
    "void": InvoiceStatus.void,
}

IMPORT_TEMPLATE_HEADER = ["contact_email", "contact_name", "status", "total", "currency", "due_date", "description"]
IMPORT_TEMPLATE_EXAMPLE = ["jan@example.com", "Jan de Vries", "pending", "250.00", "EUR", "2026-07-01", "Monthly service fee"]


def _parse_import_date(val: str) -> Optional[date]:
    val = val.strip()
    if not val:
        return None
    for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(val, fmt).date()
        except ValueError:
            continue
    return None


async def import_invoices(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    content: bytes,
    filename: str,
) -> InvoiceImportResult:
    """Parse CSV or XLSX bytes and create invoices. Matches contacts by email then name."""
    from app.modules.contacts.models import Contact as ContactModel

    rows: list[dict] = []
    fname = filename.lower()

    if fname.endswith(".xlsx"):
        try:
            from openpyxl import load_workbook
            wb = load_workbook(io.BytesIO(content))
            ws = wb.active
            all_rows = list(ws.iter_rows(values_only=True))
            # Skip metadata rows starting with '#' and find the header row
            header: Optional[list[str]] = None
            data_start = 0
            for i, row in enumerate(all_rows):
                first = str(row[0] or "").strip()
                if first.startswith("#"):
                    data_start = i + 1
                    continue
                header = [str(c or "").strip().lower() for c in row]
                data_start = i + 1
                break
            if header:
                for row in all_rows[data_start:]:
                    rows.append({header[j]: str(row[j] or "").strip() for j in range(len(header))})
        except ImportError:
            return InvoiceImportResult(imported=0, skipped=0, errors=[
                ImportRow(row=0, reason="XLSX import requires openpyxl (not installed)")
            ])
    else:
        # CSV — skip comment/metadata rows beginning with '#'
        text_content = content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(
            line for line in text_content.splitlines()
            if not line.strip().startswith("#")
        )
        rows = [dict(r) for r in reader]

    # Build contact lookup maps for this tenant (email → id, name → id)
    contacts_result = await db.execute(
        select(ContactModel.id, ContactModel.email, ContactModel.full_name)
        .where(ContactModel.tenant_id == tenant_id, ContactModel.deleted_at.is_(None))
    )
    email_map: dict[str, uuid.UUID] = {}
    name_map: dict[str, uuid.UUID] = {}
    for cid, cemail, cname in contacts_result.all():
        if cemail:
            email_map[cemail.lower()] = cid
        if cname:
            name_map[cname.lower()] = cid

    imported = 0
    skipped = 0
    errors: list[ImportRow] = []

    for line_num, row in enumerate(rows, start=2):  # 2 = first data row after header
        contact_email = row.get("contact_email", "").strip().lower()
        contact_name = row.get("contact_name", "").strip()

        contact_id: Optional[uuid.UUID] = None
        if contact_email and contact_email in email_map:
            contact_id = email_map[contact_email]
        elif contact_name and contact_name.lower() in name_map:
            contact_id = name_map[contact_name.lower()]

        if contact_id is None:
            identifier = contact_email or contact_name or "(unknown)"
            errors.append(ImportRow(row=line_num, reason=f"Contact not found: {identifier}"))
            skipped += 1
            continue

        raw_total = row.get("total", "").strip()
        try:
            total_cents = round(float(raw_total) * 100)
        except (ValueError, TypeError):
            errors.append(ImportRow(row=line_num, reason=f"Invalid total: '{raw_total}'"))
            skipped += 1
            continue

        raw_status = row.get("status", "pending").strip().lower()
        status = _STATUS_ALIASES.get(raw_status, InvoiceStatus.pending)

        currency = (row.get("currency", "EUR") or "EUR").strip().upper() or "EUR"
        due_date = _parse_import_date(row.get("due_date", ""))
        description = (row.get("description", "") or "").strip() or None

        data = InvoiceCreate(
            contact_id=contact_id,
            line_items=[],
            tax_cents=0,
            currency=currency,
            due_date=due_date,
            status=status,
            description=description or f"Imported invoice — total {raw_total} {currency}",
        )
        # Override total so it reflects the CSV value exactly (not recomputed from empty line_items).
        invoice = Invoice(
            tenant_id=tenant_id,
            invoice_number=await _next_invoice_number(db, tenant_id),
            contact_id=contact_id,
            line_items=[{"description": data.description, "quantity": 1, "unit_price_cents": total_cents}],
            subtotal_cents=total_cents,
            tax_cents=0,
            total_cents=total_cents,
            currency=currency,
            due_date=due_date,
            status=status,
        )
        db.add(invoice)
        await db.commit()
        await db.refresh(invoice)
        imported += 1

    return InvoiceImportResult(imported=imported, skipped=skipped, errors=errors)


async def get_invoice(db: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> Optional[Invoice]:
    result = await db.execute(
        select(Invoice).where(Invoice.tenant_id == tenant_id, Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if invoice is not None:
        invoice.contact_name = await _contact_name(db, tenant_id, invoice.contact_id)
    return invoice


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
