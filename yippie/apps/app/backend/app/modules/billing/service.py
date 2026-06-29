from __future__ import annotations

import base64
import csv
import io
import uuid
from collections import defaultdict
from datetime import date, datetime, timezone
from typing import Optional

from sqlalchemy import delete, func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant
from app.modules.billing.models import Invoice, InvoiceStatus, Payment, Subscription
from app.modules.billing.schemas import (
    ImportRow,
    InvoiceCreate,
    InvoiceImportResult,
    InvoiceUpdate,
    LineItem,
    PaymentCreate,
    SubscriptionCreate,
    VatBreakdownLine,
)
from app.modules.contacts.models import Contact


class PaymentError(ValueError):
    """Raised when a payment cannot be applied to an invoice."""


class InvoiceSendError(ValueError):
    """Raised when an invoice cannot be sent (missing contact email, etc.)."""


# ── VAT helpers ────────────────────────────────────────────────────────────────

def _compute_totals(line_items: list[LineItem]) -> tuple[int, int]:
    """Return (subtotal_cents, tax_cents) computed from per-line VAT rates."""
    subtotal = 0
    tax = 0
    for item in line_items:
        line_excl = item.quantity * item.unit_price_cents
        line_vat = round(line_excl * item.tax_rate_pct / 100)
        subtotal += line_excl
        tax += line_vat
    return subtotal, tax


def compute_vat_breakdown(line_items: list[dict]) -> list[VatBreakdownLine]:
    """Group line items by VAT rate and return a per-rate breakdown."""
    groups: dict[int, dict[str, int]] = defaultdict(lambda: {"subtotal": 0, "vat": 0})
    for item in line_items:
        rate = int(item.get("tax_rate_pct", 21))
        qty = int(item.get("quantity", 1))
        price = int(item.get("unit_price_cents", 0))
        line_excl = qty * price
        line_vat = round(line_excl * rate / 100)
        groups[rate]["subtotal"] += line_excl
        groups[rate]["vat"] += line_vat
    return [
        VatBreakdownLine(rate_pct=rate, subtotal_cents=v["subtotal"], vat_cents=v["vat"])
        for rate, v in sorted(groups.items())
    ]


def _enrich_invoice(invoice: Invoice) -> Invoice:
    """Attach computed vat_breakdown to an Invoice ORM object (not stored in DB)."""
    invoice.vat_breakdown = compute_vat_breakdown(invoice.line_items or [])
    return invoice


# ── Invoice numbering ──────────────────────────────────────────────────────────

async def _next_invoice_number(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtextextended(:k, 0))"),
        {"k": f"invoice:{tenant_id}"},
    )
    count = await db.scalar(
        select(func.count(Invoice.id)).where(Invoice.tenant_id == tenant_id)
    )
    return f"INV-{(count or 0) + 1:04d}"


# ── Subscriptions ──────────────────────────────────────────────────────────────

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


# ── Invoices ───────────────────────────────────────────────────────────────────

async def create_invoice(
    db: AsyncSession, tenant_id: uuid.UUID, data: InvoiceCreate
) -> Invoice:
    subtotal, tax = _compute_totals(data.line_items)
    line_items_data = [item.model_dump() for item in data.line_items]

    # If no explicit line items but a description was given, create a synthetic item.
    if not line_items_data and data.description:
        line_items_data = [{"description": data.description, "quantity": 1, "unit_price_cents": 0, "tax_rate_pct": 21}]

    invoice = Invoice(
        tenant_id=tenant_id,
        invoice_number=await _next_invoice_number(db, tenant_id),
        contact_id=data.contact_id,
        subscription_id=data.subscription_id,
        line_items=line_items_data,
        subtotal_cents=subtotal,
        tax_cents=tax,
        total_cents=subtotal + tax,
        currency=data.currency,
        invoice_date=data.invoice_date,
        due_date=data.due_date,
        notes=data.notes,
        status=data.status,
    )
    db.add(invoice)
    await db.commit()
    await db.refresh(invoice)
    invoice.contact_name = await _contact_name(db, tenant_id, invoice.contact_id)
    return _enrich_invoice(invoice)


async def _contact_name(db: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID) -> Optional[str]:
    return await db.scalar(
        select(Contact.full_name).where(
            Contact.id == contact_id, Contact.tenant_id == tenant_id
        )
    )


async def list_invoices(
    db: AsyncSession, tenant_id: uuid.UUID, contact_id: Optional[uuid.UUID] = None
) -> list[Invoice]:
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
        _enrich_invoice(invoice)
        invoices.append(invoice)
    return invoices


async def get_invoice(db: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID) -> Optional[Invoice]:
    result = await db.execute(
        select(Invoice).where(Invoice.tenant_id == tenant_id, Invoice.id == invoice_id)
    )
    invoice = result.scalar_one_or_none()
    if invoice is not None:
        invoice.contact_name = await _contact_name(db, tenant_id, invoice.contact_id)
        _enrich_invoice(invoice)
    return invoice


async def update_invoice(
    db: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID, data: InvoiceUpdate
) -> Optional[Invoice]:
    invoice = await get_invoice(db, tenant_id, invoice_id)
    if invoice is None:
        return None
    for field, value in data.model_dump(exclude_none=True).items():
        setattr(invoice, field, value)
    await db.commit()
    await db.refresh(invoice)
    invoice.contact_name = await _contact_name(db, tenant_id, invoice.contact_id)
    return _enrich_invoice(invoice)


async def bulk_delete_invoices(
    db: AsyncSession, tenant_id: uuid.UUID, ids: list[uuid.UUID]
) -> int:
    if not ids:
        return 0
    await db.execute(
        delete(Payment).where(Payment.tenant_id == tenant_id, Payment.invoice_id.in_(ids))
    )
    result = await db.execute(
        delete(Invoice).where(Invoice.tenant_id == tenant_id, Invoice.id.in_(ids))
    )
    await db.commit()
    return result.rowcount or 0


# ── PDF + email ────────────────────────────────────────────────────────────────

async def _get_tenant_and_contact(
    db: AsyncSession, tenant_id: uuid.UUID, invoice: Invoice
) -> tuple[Tenant, Optional[Contact]]:
    tenant = await db.get(Tenant, tenant_id)
    contact = await db.get(Contact, invoice.contact_id) if invoice.contact_id else None
    return tenant, contact


async def generate_pdf_bytes(
    db: AsyncSession, tenant_id: uuid.UUID, invoice: Invoice
) -> bytes:
    import asyncio
    from app.modules.billing.pdf import generate_invoice_pdf

    tenant, contact = await _get_tenant_and_contact(db, tenant_id, invoice)
    return await asyncio.to_thread(generate_invoice_pdf, invoice, tenant, contact)


async def send_invoice(
    db: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID
) -> str:
    """Generate PDF and email it to the contact. Returns the contact email address."""
    from app.core.email_html import render_email_html
    from app.core.mailer import send_email

    invoice = await get_invoice(db, tenant_id, invoice_id)
    if not invoice:
        raise InvoiceSendError("Invoice not found")

    tenant, contact = await _get_tenant_and_contact(db, tenant_id, invoice)
    if not contact or not contact.email:
        raise InvoiceSendError("Contact has no email address")

    pdf_bytes = await generate_pdf_bytes(db, tenant_id, invoice)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    inv_date = invoice.invoice_date or (invoice.created_at.date() if invoice.created_at else None)
    date_str = inv_date.strftime("%d-%m-%Y") if inv_date else ""
    total_str = f"€{invoice.total_cents / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    body = (
        f"Geachte {contact.full_name},\n\n"
        f"Bijgevoegd vindt u factuur {invoice.invoice_number} van {date_str} "
        f"voor een bedrag van {total_str}.\n\n"
    )
    if invoice.due_date:
        due_str = invoice.due_date.strftime("%d-%m-%Y")
        body += f"Wij verzoeken u vriendelijk het bedrag vóór {due_str} te voldoen.\n\n"
    if invoice.notes:
        body += f"{invoice.notes}\n\n"
    body += f"Met vriendelijke groet,\n{tenant.name or ''}"

    html = render_email_html(
        body_text=body,
        tenant_name=tenant.name or "",
        primary_color=tenant.primary_color or "#5BA4F5",
        logo_url=tenant.logo_url,
    )

    try:
        await send_email(
            to=contact.email,
            subject=f"Factuur {invoice.invoice_number} — {tenant.name or ''}",
            body=body,
            html=html,
            attachments=[{
                "filename": f"factuur-{invoice.invoice_number}.pdf",
                "content": pdf_b64,
                "content_type": "application/pdf",
            }],
        )
    except Exception as exc:
        from app.core.mailer import ResendNotConfiguredError
        if isinstance(exc, ResendNotConfiguredError):
            raise InvoiceSendError(str(exc)) from exc
        raise

    invoice.status = InvoiceStatus.sent
    await db.commit()
    return contact.email


async def send_payment_reminder(
    db: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID
) -> str:
    """Send a payment reminder email. Returns the contact email address."""
    from app.core.email_html import render_email_html
    from app.core.mailer import send_email

    invoice = await get_invoice(db, tenant_id, invoice_id)
    if not invoice:
        raise InvoiceSendError("Invoice not found")

    tenant, contact = await _get_tenant_and_contact(db, tenant_id, invoice)
    if not contact or not contact.email:
        raise InvoiceSendError("Contact has no email address")

    pdf_bytes = await generate_pdf_bytes(db, tenant_id, invoice)
    pdf_b64 = base64.b64encode(pdf_bytes).decode("utf-8")

    total_str = f"€{invoice.total_cents / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")
    due_str = invoice.due_date.strftime("%d-%m-%Y") if invoice.due_date else "zo spoedig mogelijk"

    body = (
        f"Geachte {contact.full_name},\n\n"
        f"Wij hebben geconstateerd dat factuur {invoice.invoice_number} "
        f"ter waarde van {total_str} nog niet is voldaan.\n\n"
        f"Wij verzoeken u vriendelijk het openstaande bedrag vóór {due_str} te betalen.\n\n"
    )
    if invoice.notes:
        body += f"{invoice.notes}\n\n"
    body += f"Heeft u al betaald? Dan kunt u dit bericht als niet verzonden beschouwen.\n\n"
    body += f"Met vriendelijke groet,\n{tenant.name or ''}"

    html = render_email_html(
        body_text=body,
        tenant_name=tenant.name or "",
        primary_color=tenant.primary_color or "#5BA4F5",
        logo_url=tenant.logo_url,
    )

    try:
        await send_email(
            to=contact.email,
            subject=f"Betalingsherinnering: {invoice.invoice_number} — {tenant.name or ''}",
            body=body,
            html=html,
            attachments=[{
                "filename": f"factuur-{invoice.invoice_number}.pdf",
                "content": pdf_b64,
                "content_type": "application/pdf",
            }],
        )
    except Exception as exc:
        from app.core.mailer import ResendNotConfiguredError
        if isinstance(exc, ResendNotConfiguredError):
            raise InvoiceSendError(str(exc)) from exc
        raise
    return contact.email


# ── Payments ───────────────────────────────────────────────────────────────────

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

    paid_so_far = await db.scalar(
        select(func.coalesce(func.sum(Payment.amount_cents), 0)).where(Payment.invoice_id == invoice.id)
    )
    if (paid_so_far or 0) + data.amount_cents >= invoice.total_cents and invoice.status != InvoiceStatus.paid:
        invoice.status = InvoiceStatus.paid
        invoice.paid_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(payment)
    return payment


async def list_payments(
    db: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID
) -> list[Payment]:
    result = await db.execute(
        select(Payment)
        .where(Payment.tenant_id == tenant_id, Payment.invoice_id == invoice_id)
        .order_by(Payment.paid_at.asc())
    )
    return result.scalars().all()


# ── Export / Import ────────────────────────────────────────────────────────────

async def export_invoices(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    ids: Optional[list[uuid.UUID]] = None,
    fmt: str = "csv",
) -> tuple[bytes, str, str]:
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
            fmt = "csv"
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
    from app.modules.contacts.models import Contact as ContactModel

    rows: list[dict] = []
    fname = filename.lower()

    if fname.endswith(".xlsx"):
        try:
            from openpyxl import load_workbook
            wb = load_workbook(io.BytesIO(content))
            ws = wb.active
            all_rows = list(ws.iter_rows(values_only=True))
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
        text_content = content.decode("utf-8-sig", errors="replace")
        reader = csv.DictReader(
            line for line in text_content.splitlines()
            if not line.strip().startswith("#")
        )
        rows = [dict(r) for r in reader]

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

    for line_num, row in enumerate(rows, start=2):
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

        inv = Invoice(
            tenant_id=tenant_id,
            invoice_number=await _next_invoice_number(db, tenant_id),
            contact_id=contact_id,
            line_items=[{
                "description": description or f"Imported invoice — {raw_total} {currency}",
                "quantity": 1,
                "unit_price_cents": total_cents,
                "tax_rate_pct": 21,
            }],
            subtotal_cents=total_cents,
            tax_cents=round(total_cents * 21 / 100),
            total_cents=total_cents + round(total_cents * 21 / 100),
            currency=currency,
            due_date=due_date,
            status=status,
        )
        db.add(inv)
        await db.commit()
        await db.refresh(inv)
        imported += 1

    return InvoiceImportResult(imported=imported, skipped=skipped, errors=errors)
