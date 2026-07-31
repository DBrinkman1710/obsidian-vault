from __future__ import annotations

import base64
import csv
import io
import re
import uuid
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import delete, func, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant
from app.modules.billing.models import Invoice, InvoiceStatus, InvoiceTemplate, Payment, Subscription
from app.modules.billing.schemas import (
    ImportRow,
    InvoiceCreate,
    InvoiceImportResult,
    InvoiceTemplateCreate,
    InvoiceTemplateUpdate,
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


class InvoiceLockedError(ValueError):
    """Raised when an issued invoice is edited or deleted. Issued invoices are
    immutable by law — correct them with a credit note instead."""


class InvoiceComplianceError(ValueError):
    """Raised when an invoice is missing fields a Dutch invoice legally needs."""


# ── VAT helpers ────────────────────────────────────────────────────────────────

def _effective_rate(rate_pct: int, reverse_charge: bool) -> int:
    """VAT actually charged. Under BTW verlegd the supplier charges nothing —
    the customer accounts for it — so every line drops to 0 regardless of the
    rate the item would otherwise carry."""
    return 0 if reverse_charge else rate_pct


def _compute_totals(line_items: list[LineItem], reverse_charge: bool = False) -> tuple[int, int]:
    """Return (subtotal_cents, tax_cents) computed from per-line VAT rates."""
    subtotal = 0
    tax = 0
    for item in line_items:
        line_excl = item.quantity * item.unit_price_cents
        line_vat = round(line_excl * _effective_rate(item.tax_rate_pct, reverse_charge) / 100)
        subtotal += line_excl
        tax += line_vat
    return subtotal, tax


def compute_vat_breakdown(
    line_items: list[dict], reverse_charge: bool = False
) -> list[VatBreakdownLine]:
    """Group line items by VAT rate and return a per-rate breakdown."""
    groups: dict[int, dict[str, int]] = defaultdict(lambda: {"subtotal": 0, "vat": 0})
    for item in line_items:
        rate = _effective_rate(int(item.get("tax_rate_pct", 21)), reverse_charge)
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
    invoice.vat_breakdown = compute_vat_breakdown(
        invoice.line_items or [], bool(invoice.reverse_charge)
    )
    return invoice


# ── Invoice numbering ──────────────────────────────────────────────────────────

async def _claim_invoice_number(db: AsyncSession, tenant_id: uuid.UUID) -> str:
    """Claim the tenant's next invoice number.

    One atomic UPSERT: concurrent callers serialise on the counter row, and the
    number is derived from a persistent counter rather than a row count, so a
    deleted invoice can never hand its number to a later one.
    """
    row = await db.execute(
        text(
            """
            INSERT INTO invoice_counters (tenant_id, last_number)
            VALUES (:tenant_id, 1)
            ON CONFLICT (tenant_id)
            DO UPDATE SET last_number = invoice_counters.last_number + 1,
                          updated_at  = NOW()
            RETURNING last_number, prefix
            """
        ),
        {"tenant_id": str(tenant_id)},
    )
    number, prefix = row.one()
    return f"{prefix}-{number:04d}"


# ── Immutability ───────────────────────────────────────────────────────────────

# Fields that describe the document itself. Once issued these are frozen; only
# lifecycle state (status, payments) may still move.
_LOCKED_FIELDS = {
    "line_items", "subtotal_cents", "tax_cents", "total_cents", "currency",
    "invoice_date", "invoice_number", "contact_id", "notes", "payment_terms",
    "reverse_charge", "due_date",
}

# Status moves that remain legal after issue: they record what happened to the
# invoice, they do not rewrite it. Voiding goes through the credit note path.
_ALLOWED_ISSUED_STATUSES = {
    InvoiceStatus.sent, InvoiceStatus.paid, InvoiceStatus.overdue,
    InvoiceStatus.received,
}


def _assert_mutable(invoice: Invoice, changes: dict) -> None:
    """Reject edits to an issued invoice's content."""
    if not invoice.is_issued:
        return
    blocked = sorted(_LOCKED_FIELDS & set(changes))
    if blocked:
        raise InvoiceLockedError(
            f"Invoice {invoice.invoice_number} was issued on "
            f"{invoice.issued_at:%d-%m-%Y} and can no longer be changed "
            f"({', '.join(blocked)}). Issue a credit note to correct it."
        )
    new_status = changes.get("status")
    if new_status is not None and new_status not in _ALLOWED_ISSUED_STATUSES:
        raise InvoiceLockedError(
            f"An issued invoice cannot be moved to '{getattr(new_status, 'value', new_status)}'. "
            "Issue a credit note to reverse it."
        )


# ── Compliance validation ──────────────────────────────────────────────────────

def _missing_invoice_fields(invoice: Invoice, tenant: Tenant, contact: Optional[Contact]) -> list[str]:
    """Fields a Dutch invoice must carry before it can legally be issued."""
    missing: list[str] = []

    if not invoice.invoice_date:
        missing.append("factuurdatum (invoice date)")
    if not (invoice.line_items or []):
        missing.append("minstens één factuurregel (at least one line item)")

    if not (tenant and tenant.name):
        missing.append("bedrijfsnaam afzender (your company name)")
    if not (tenant and tenant.street_address):
        missing.append("adres afzender (your address)")
    if not (tenant and tenant.kvk_nummer):
        missing.append("KvK nummer afzender (your Chamber of Commerce number)")
    if not (tenant and tenant.btw_nummer):
        missing.append("BTW nummer afzender (your VAT number)")

    if contact is None:
        missing.append("klant (client)")
    else:
        if not contact.full_name:
            missing.append("naam klant (client name)")
        if not contact.street_address:
            missing.append("adres klant (client address)")
        # Reverse charge is only valid to a VAT registered business — without the
        # customer's number the statement cannot legally be made.
        if invoice.reverse_charge and not contact.btw_nummer:
            missing.append("BTW nummer klant (client VAT number, required for BTW verlegd)")

    return missing


def _snapshot_seller(tenant: Optional[Tenant]) -> dict:
    return {
        "name": (tenant.name if tenant else None) or "",
        "street_address": getattr(tenant, "street_address", None),
        "postal_code": getattr(tenant, "postal_code", None),
        "city": getattr(tenant, "city", None),
        "country": getattr(tenant, "country", None),
        "kvk_nummer": getattr(tenant, "kvk_nummer", None),
        "btw_nummer": getattr(tenant, "btw_nummer", None),
        "iban": getattr(tenant, "iban", None),
        "phone": getattr(tenant, "phone", None),
    }


def _party_lines(party: dict, is_seller: bool) -> list[str]:
    """Flatten a party snapshot into printable address lines."""
    lines: list[str] = []
    if not is_seller:
        # The recipient block leads with who is being invoiced.
        name = party.get("full_name") or ""
        company = party.get("company_name")
        if name:
            lines.append(name)
        if company and company != name:
            lines.append(company)
    if party.get("street_address"):
        lines.append(party["street_address"])
    if party.get("postal_code") or party.get("city"):
        lines.append(f"{party.get('postal_code') or ''} {party.get('city') or ''}".strip())
    if party.get("country") and party["country"] != "Nederland":
        lines.append(party["country"])
    if is_seller:
        if party.get("phone"):
            lines.append(party["phone"])
        if party.get("kvk_nummer"):
            lines.append(f"KvK: {party['kvk_nummer']}")
    if party.get("btw_nummer"):
        lines.append(f"BTW: {party['btw_nummer']}")
    if is_seller and party.get("iban"):
        lines.append(f"IBAN: {party['iban']}")
    return lines


def _snapshot_client(contact: Optional[Contact]) -> dict:
    if contact is None:
        return {}
    return {
        "full_name": contact.full_name,
        "company_name": getattr(contact, "company_name", None),
        "email": contact.email,
        "street_address": getattr(contact, "street_address", None),
        "postal_code": getattr(contact, "postal_code", None),
        "city": getattr(contact, "city", None),
        "country": getattr(contact, "country", None),
        "btw_nummer": getattr(contact, "btw_nummer", None),
    }


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


# ── Invoice templates ([TMPL1]) ───────────────────────────────────────────────

async def list_invoice_templates(db: AsyncSession, tenant_id: uuid.UUID) -> list[InvoiceTemplate]:
    result = await db.execute(
        select(InvoiceTemplate)
        .where(InvoiceTemplate.tenant_id == tenant_id)
        .order_by(InvoiceTemplate.created_at.desc())
    )
    return list(result.scalars().all())


async def get_invoice_template(
    db: AsyncSession, tenant_id: uuid.UUID, template_id: uuid.UUID
) -> Optional[InvoiceTemplate]:
    result = await db.execute(
        select(InvoiceTemplate).where(
            InvoiceTemplate.id == template_id, InvoiceTemplate.tenant_id == tenant_id
        )
    )
    return result.scalar_one_or_none()


async def create_invoice_template(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID, data: InvoiceTemplateCreate
) -> InvoiceTemplate:
    from app.core.doc_blocks import validate_blocks

    template = InvoiceTemplate(
        tenant_id=tenant_id,
        created_by=created_by,
        name=data.name,
        default_tax_rate_pct=data.default_tax_rate_pct,
        default_due_days=data.default_due_days,
        default_notes=data.default_notes,
    )
    if data.blocks is not None:
        template.blocks = validate_blocks(data.blocks, "invoice").model_dump()  # raises ValueError
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template


async def update_invoice_template(
    db: AsyncSession, tenant_id: uuid.UUID, template_id: uuid.UUID, data: InvoiceTemplateUpdate
) -> Optional[InvoiceTemplate]:
    from app.core.doc_blocks import validate_blocks

    template = await get_invoice_template(db, tenant_id, template_id)
    if not template:
        return None
    changes = data.model_dump(exclude_unset=True)
    blocks = changes.pop("blocks", None)
    if blocks is not None:
        template.blocks = validate_blocks(blocks, "invoice").model_dump()  # raises ValueError
    for field, value in changes.items():
        setattr(template, field, value)
    await db.commit()
    await db.refresh(template)
    return template


async def delete_invoice_template(
    db: AsyncSession, tenant_id: uuid.UUID, template_id: uuid.UUID
) -> bool:
    result = await db.execute(
        delete(InvoiceTemplate).where(
            InvoiceTemplate.id == template_id, InvoiceTemplate.tenant_id == tenant_id
        )
    )
    await db.commit()
    return bool(result.rowcount)


async def set_default_invoice_template(
    db: AsyncSession, tenant_id: uuid.UUID, template_id: uuid.UUID
) -> Optional[InvoiceTemplate]:
    """Make this the tenant default — clears any other default first (the
    partial unique index guards concurrent races)."""
    template = await get_invoice_template(db, tenant_id, template_id)
    if not template:
        return None
    await db.execute(
        update(InvoiceTemplate)
        .where(InvoiceTemplate.tenant_id == tenant_id, InvoiceTemplate.is_default.is_(True))
        .values(is_default=False)
    )
    template.is_default = True
    await db.commit()
    await db.refresh(template)
    return template


async def resolve_invoice_template(
    db: AsyncSession, tenant_id: uuid.UUID, invoice: Invoice | None = None
) -> Optional[InvoiceTemplate]:
    """Explicit per invoice override first, else the tenant default, else None
    (None = the legacy hardcoded PDF layout)."""
    if invoice is not None and invoice.template_id:
        template = await get_invoice_template(db, tenant_id, invoice.template_id)
        if template:
            return template
    result = await db.execute(
        select(InvoiceTemplate).where(
            InvoiceTemplate.tenant_id == tenant_id, InvoiceTemplate.is_default.is_(True)
        )
    )
    return result.scalar_one_or_none()


# ── Invoices ───────────────────────────────────────────────────────────────────

async def create_invoice(
    db: AsyncSession, tenant_id: uuid.UUID, data: InvoiceCreate
) -> Invoice:
    subtotal, tax = _compute_totals(data.line_items, data.reverse_charge)
    line_items_data = [item.model_dump() for item in data.line_items]

    # If no explicit line items but a description was given, create a synthetic item.
    if not line_items_data and data.description:
        line_items_data = [{"description": data.description, "quantity": 1, "unit_price_cents": 0, "tax_rate_pct": 21}]

    # Template defaults ([TMPL1]) — only fill what the caller left empty; line
    # items are never mutated (the tax rate default is a frontend prefill).
    due_date = data.due_date
    notes = data.notes
    template = None
    if data.template_id:
        template = await get_invoice_template(db, tenant_id, data.template_id)
    if template is None:
        template = await resolve_invoice_template(db, tenant_id)
    if template is not None:
        if due_date is None and template.default_due_days is not None:
            due_date = (data.invoice_date or date.today()) + timedelta(days=template.default_due_days)
        if notes is None and template.default_notes:
            notes = template.default_notes

    invoice = Invoice(
        tenant_id=tenant_id,
        # No number yet — claimed at issue time so the issued series never gaps
        # on a draft that gets discarded.
        invoice_number=None,
        contact_id=data.contact_id,
        subscription_id=data.subscription_id,
        line_items=line_items_data,
        subtotal_cents=subtotal,
        tax_cents=tax,
        total_cents=subtotal + tax,
        currency=data.currency,
        invoice_date=data.invoice_date,
        due_date=due_date,
        notes=notes,
        payment_terms=data.payment_terms,
        reverse_charge=data.reverse_charge,
        template_id=template.id if template is not None else None,
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

    changes = data.model_dump(exclude_none=True)
    _assert_mutable(invoice, changes)  # raises InvoiceLockedError

    for field, value in changes.items():
        setattr(invoice, field, value)

    # Content changed on a draft — totals must follow the line items. Recomputed
    # from the stored dicts so a legacy rate outside 0/9/21 still totals up
    # rather than failing validation on data that predates the constraint.
    if not invoice.is_issued:
        breakdown = compute_vat_breakdown(invoice.line_items or [], bool(invoice.reverse_charge))
        invoice.subtotal_cents = sum(b.subtotal_cents for b in breakdown)
        invoice.tax_cents = sum(b.vat_cents for b in breakdown)
        invoice.total_cents = invoice.subtotal_cents + invoice.tax_cents

        # Marking an invoice sent/received/paid by hand — the normal flow for a
        # business that posts or emails invoices itself — issues it just as
        # sending through the app does. Without this the status dropdown would
        # be a way around immutability: the row would read "Sent" while staying
        # editable and deletable.
        if changes.get("status") in _ALLOWED_ISSUED_STATUSES:
            await db.commit()  # persist the edits before the number is claimed
            return await issue_invoice(db, tenant_id, invoice_id)

    await db.commit()
    await db.refresh(invoice)
    invoice.contact_name = await _contact_name(db, tenant_id, invoice.contact_id)
    return _enrich_invoice(invoice)


async def issue_invoice(
    db: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID
) -> Invoice:
    """Finalise a draft: validate, claim its number, freeze the parties, lock it.

    Idempotent — re issuing an already issued invoice returns it untouched, so
    send/issue can be called in either order without burning a number.
    """
    invoice = await get_invoice(db, tenant_id, invoice_id)
    if invoice is None:
        raise InvoiceSendError("Invoice not found")
    if invoice.is_issued:
        return invoice

    tenant, contact = await _get_tenant_and_contact(db, tenant_id, invoice)

    missing = _missing_invoice_fields(invoice, tenant, contact)
    if missing:
        raise InvoiceComplianceError(
            "This invoice is missing legally required details: " + "; ".join(missing)
        )

    invoice.invoice_number = await _claim_invoice_number(db, tenant_id)
    invoice.seller_snapshot = _snapshot_seller(tenant)
    invoice.client_snapshot = _snapshot_client(contact)
    invoice.issued_at = datetime.now(timezone.utc)
    if invoice.status in (InvoiceStatus.draft, InvoiceStatus.pending, InvoiceStatus.not_sent):
        invoice.status = InvoiceStatus.sent

    await db.commit()
    await db.refresh(invoice)
    invoice.contact_name = await _contact_name(db, tenant_id, invoice.contact_id)
    return _enrich_invoice(invoice)


async def create_credit_note(
    db: AsyncSession, tenant_id: uuid.UUID, invoice_id: uuid.UUID
) -> Invoice:
    """Reverse an issued invoice with a creditfactuur.

    The original stays exactly as it was sent — it really was issued — and a new
    document with its own number carries the negated amounts. This is the only
    lawful way to undo an issued invoice.
    """
    original = await get_invoice(db, tenant_id, invoice_id)
    if original is None:
        raise InvoiceSendError("Invoice not found")
    if not original.is_issued:
        raise InvoiceComplianceError(
            "This invoice was never issued — delete the draft instead of crediting it."
        )
    if original.credit_note_of_id is not None:
        raise InvoiceComplianceError("A credit note cannot itself be credited.")

    existing = await db.scalar(
        select(func.count(Invoice.id)).where(
            Invoice.tenant_id == tenant_id, Invoice.credit_note_of_id == original.id
        )
    )
    if existing:
        raise InvoiceComplianceError(
            f"Invoice {original.invoice_number} has already been credited."
        )

    negated = [
        {**item, "unit_price_cents": -int(item.get("unit_price_cents", 0))}
        for item in (original.line_items or [])
    ]
    today = date.today()

    credit = Invoice(
        tenant_id=tenant_id,
        invoice_number=await _claim_invoice_number(db, tenant_id),
        contact_id=original.contact_id,
        subscription_id=original.subscription_id,
        line_items=negated,
        subtotal_cents=-original.subtotal_cents,
        tax_cents=-original.tax_cents,
        total_cents=-original.total_cents,
        currency=original.currency,
        invoice_date=today,
        due_date=today,
        reverse_charge=original.reverse_charge,
        notes=f"Creditfactuur bij factuur {original.invoice_number}.",
        payment_terms=original.payment_terms,
        template_id=original.template_id,
        credit_note_of_id=original.id,
        # Carry the original parties so the credit note reproduces the same
        # names and addresses even if the client has since moved.
        seller_snapshot=original.seller_snapshot,
        client_snapshot=original.client_snapshot,
        status=InvoiceStatus.sent,
        issued_at=datetime.now(timezone.utc),
    )
    db.add(credit)

    # The original is now reversed; this is a lifecycle change, not a rewrite.
    original.status = InvoiceStatus.void

    await db.commit()
    await db.refresh(credit)
    credit.contact_name = await _contact_name(db, tenant_id, credit.contact_id)
    return _enrich_invoice(credit)


async def bulk_delete_invoices(
    db: AsyncSession, tenant_id: uuid.UUID, ids: list[uuid.UUID]
) -> int:
    """Delete drafts only. An issued invoice must survive its 7 year retention
    period, so deleting one is refused outright rather than silently skipped."""
    if not ids:
        return 0

    issued = await db.execute(
        select(Invoice.invoice_number).where(
            Invoice.tenant_id == tenant_id,
            Invoice.id.in_(ids),
            Invoice.issued_at.is_not(None),
        )
    )
    locked = [n for (n,) in issued.all()]
    if locked:
        raise InvoiceLockedError(
            "These invoices have been issued and cannot be deleted: "
            + ", ".join(sorted(locked))
            + ". Issue a credit note instead."
        )

    await db.execute(
        delete(Payment).where(Payment.tenant_id == tenant_id, Payment.invoice_id.in_(ids))
    )
    result = await db.execute(
        delete(Invoice).where(
            Invoice.tenant_id == tenant_id,
            Invoice.id.in_(ids),
            Invoice.issued_at.is_(None),
        )
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


def _invoice_meta_lines(invoice: Invoice) -> list[tuple[str, str]]:
    """Number/date/due date lines for the logo_header block's right column."""
    inv_date = invoice.invoice_date or (invoice.created_at.date() if invoice.created_at else None)
    fmt = lambda d: d.strftime("%d-%m-%Y") if d else "-"  # noqa: E731
    return [
        ("Factuurnummer", invoice.invoice_number or "CONCEPT"),
        ("Factuurdatum", fmt(inv_date)),
        ("Vervaldatum", fmt(invoice.due_date)),
    ]


async def generate_pdf_bytes(
    db: AsyncSession, tenant_id: uuid.UUID, invoice: Invoice
) -> bytes:
    import asyncio
    from app.modules.billing.pdf import generate_invoice_pdf

    tenant, contact = await _get_tenant_and_contact(db, tenant_id, invoice)

    # [TMPL1] block layout when a template resolves; the legacy hardcoded
    # layout stays the fallback so template less tenants see zero change.
    template = await resolve_invoice_template(db, tenant_id, invoice)
    if template is not None:
        from app.core.doc_blocks import (
            invoice_merge_values,
            resolve_merge_fields_in_blocks,
            validate_blocks,
        )
        from app.core.doc_blocks_pdf import RenderContext, render_blocks_pdf

        doc = validate_blocks(template.blocks, "invoice")
        resolved = resolve_merge_fields_in_blocks(doc, invoice_merge_values(invoice, tenant, contact))

        seller = invoice.seller_snapshot or _snapshot_seller(tenant)
        client = invoice.client_snapshot or _snapshot_client(contact)
        statement = "BTW verlegd"
        if client.get("btw_nummer"):
            statement += f" naar BTW nummer {client['btw_nummer']}"

        ctx = RenderContext(
            doc_type="invoice",
            tenant=tenant,
            tenant_name=seller.get("name") or (tenant.name if tenant else "") or "",
            primary_color=getattr(tenant, "primary_color", None),
            currency=invoice.currency or "EUR",
            line_items=invoice.line_items or [],
            meta_lines=_invoice_meta_lines(invoice),
            notes=invoice.notes,
            reverse_charge=bool(invoice.reverse_charge),
            seller_lines=_party_lines(seller, is_seller=True),
            client_lines=_party_lines(client, is_seller=False),
            reverse_charge_statement=statement,
        )
        return await asyncio.to_thread(render_blocks_pdf, resolved, ctx)

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

    _, contact = await _get_tenant_and_contact(db, tenant_id, invoice)
    # Checked before issuing so the commonest failure does not burn a number.
    if not contact or not contact.email:
        raise InvoiceSendError("Contact has no email address")

    # Sending is what makes an invoice legally issued: this validates the
    # required fields, claims the number and freezes both parties. Idempotent,
    # so resending an already issued invoice reuses its original number.
    invoice = await issue_invoice(db, tenant_id, invoice_id)
    tenant, contact = await _get_tenant_and_contact(db, tenant_id, invoice)

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
            subject=f"Factuur {invoice.invoice_number} | {tenant.name or ''}",
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
            subject=f"Betalingsherinnering: {invoice.invoice_number} | {tenant.name or ''}",
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

    # Bookkeeping tools need the VAT split per rate to reconcile a BTW aangifte,
    # so each Dutch rate gets its own pair of columns. No leading comment rows —
    # they break a straight CSV import into Moneybird/Exact; the seller's own
    # KvK/BTW ride along on every row instead.
    RATES = (21, 9, 0)

    header = [
        "invoice_number", "invoice_date", "due_date", "issued_at", "status",
        "client_name", "client_btw_nummer", "client_address", "client_postal_code",
        "client_city", "client_country",
        "subtotal_excl_vat",
        *[f"vat_base_{r}pct" for r in RATES],
        *[f"vat_amount_{r}pct" for r in RATES],
        "vat_total", "total_incl_vat", "currency",
        "reverse_charge", "credit_note_of", "payment_terms",
        "seller_kvk_nummer", "seller_btw_nummer",
    ]

    # Credit notes reference the original by number, not by an opaque UUID.
    number_by_id: dict[uuid.UUID, str] = {
        inv.id: (inv.invoice_number or "") for inv, _ in rows
    }

    def _row(invoice: Invoice, contact_name: Optional[str]) -> list:
        snap = invoice.client_snapshot or {}
        seller = invoice.seller_snapshot or {}
        breakdown = {
            b.rate_pct: b for b in compute_vat_breakdown(
                invoice.line_items or [], bool(invoice.reverse_charge)
            )
        }

        def money(cents: int) -> str:
            return f"{cents / 100:.2f}"

        return [
            invoice.invoice_number or "CONCEPT",
            invoice.invoice_date.isoformat() if invoice.invoice_date else "",
            invoice.due_date.isoformat() if invoice.due_date else "",
            invoice.issued_at.isoformat() if invoice.issued_at else "",
            invoice.status.value if hasattr(invoice.status, "value") else str(invoice.status),
            snap.get("full_name") or contact_name or "",
            snap.get("btw_nummer") or "",
            snap.get("street_address") or "",
            snap.get("postal_code") or "",
            snap.get("city") or "",
            snap.get("country") or "",
            money(invoice.subtotal_cents),
            *[money(breakdown[r].subtotal_cents) if r in breakdown else "0.00" for r in RATES],
            *[money(breakdown[r].vat_cents) if r in breakdown else "0.00" for r in RATES],
            money(invoice.tax_cents),
            money(invoice.total_cents),
            invoice.currency,
            "yes" if invoice.reverse_charge else "no",
            number_by_id.get(invoice.credit_note_of_id, "") if invoice.credit_note_of_id else "",
            invoice.payment_terms or "",
            seller.get("kvk_nummer") or (tenant.kvk_nummer if tenant else "") or "",
            seller.get("btw_nummer") or (tenant.btw_nummer if tenant else "") or "",
        ]

    # One row per line item, so a multi rate invoice keeps its detail.
    line_header = [
        "invoice_number", "invoice_date", "description", "quantity",
        "unit_price_excl_vat", "line_total_excl_vat", "vat_rate_pct", "vat_amount", "currency",
    ]

    def _line_rows(invoice: Invoice) -> list[list]:
        out = []
        for item in invoice.line_items or []:
            qty = int(item.get("quantity", 1))
            unit = int(item.get("unit_price_cents", 0))
            rate = _effective_rate(int(item.get("tax_rate_pct", 21)), bool(invoice.reverse_charge))
            excl = qty * unit
            out.append([
                invoice.invoice_number or "CONCEPT",
                invoice.invoice_date.isoformat() if invoice.invoice_date else "",
                str(item.get("description", "")),
                qty,
                f"{unit / 100:.2f}",
                f"{excl / 100:.2f}",
                rate,
                f"{round(excl * rate / 100) / 100:.2f}",
                invoice.currency,
            ])
        return out

    if fmt == "xlsx":
        try:
            from openpyxl import Workbook
        except ImportError:
            fmt = "csv"
        else:
            wb = Workbook()
            ws = wb.active
            ws.title = "Invoices"
            ws.append(header)
            for invoice, contact_name in rows:
                ws.append(_row(invoice, contact_name))
            ws_lines = wb.create_sheet("Line items")
            ws_lines.append(line_header)
            for invoice, _ in rows:
                for line in _line_rows(invoice):
                    ws_lines.append(line)
            buf = io.BytesIO()
            wb.save(buf)
            return (
                buf.getvalue(),
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                "invoices.xlsx",
            )

    buf = io.StringIO()
    writer = csv.writer(buf)
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

IMPORT_TEMPLATE_HEADER = [
    "invoice_number", "contact_email", "contact_name", "status", "total",
    "currency", "invoice_date", "due_date", "description", "tax_rate_pct",
]
IMPORT_TEMPLATE_EXAMPLE = [
    "INV-0001", "jan@example.com", "Jan de Vries", "pending", "250.00",
    "EUR", "2026-06-01", "2026-07-01", "Monthly service fee", "21",
]


async def _sync_counter_at_least(db: AsyncSession, tenant_id: uuid.UUID, number: int) -> None:
    """Push the tenant's counter up to `number` if an imported invoice already
    used it, so a later invoice can never be handed a number that exists."""
    await db.execute(
        text(
            """
            INSERT INTO invoice_counters (tenant_id, last_number)
            VALUES (:tenant_id, :number)
            ON CONFLICT (tenant_id)
            DO UPDATE SET last_number = GREATEST(invoice_counters.last_number, :number),
                          updated_at  = NOW()
            """
        ),
        {"tenant_id": str(tenant_id), "number": number},
    )


def _numeric_suffix(invoice_number: str) -> Optional[int]:
    digits = re.sub(r"\D", "", invoice_number or "")
    return int(digits) if digits else None


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
        invoice_date = _parse_import_date(row.get("invoice_date", ""))
        due_date = _parse_import_date(row.get("due_date", ""))
        description = (row.get("description", "") or "").strip() or None

        try:
            tax_rate = int(float(row.get("tax_rate_pct", "") or 21))
        except (ValueError, TypeError):
            tax_rate = 21

        # An imported invoice normally comes from a system that already issued
        # it, so its original number is preserved and the row lands locked.
        # Without one it arrives as an editable draft.
        source_number = (row.get("invoice_number", "") or "").strip() or None
        if source_number:
            clash = await db.scalar(
                select(func.count(Invoice.id)).where(
                    Invoice.tenant_id == tenant_id, Invoice.invoice_number == source_number
                )
            )
            if clash:
                errors.append(ImportRow(row=line_num, reason=f"Invoice number already exists: {source_number}"))
                skipped += 1
                continue

        tax_cents = round(total_cents * tax_rate / 100)
        inv = Invoice(
            tenant_id=tenant_id,
            invoice_number=source_number,
            contact_id=contact_id,
            line_items=[{
                "description": description or f"Imported invoice: {raw_total} {currency}",
                "quantity": 1,
                "unit_price_cents": total_cents,
                "tax_rate_pct": tax_rate,
            }],
            subtotal_cents=total_cents,
            tax_cents=tax_cents,
            total_cents=total_cents + tax_cents,
            currency=currency,
            invoice_date=invoice_date,
            due_date=due_date,
            status=status,
            issued_at=datetime.now(timezone.utc) if source_number else None,
        )
        db.add(inv)

        if source_number:
            suffix = _numeric_suffix(source_number)
            if suffix is not None:
                await _sync_counter_at_least(db, tenant_id, suffix)

        await db.commit()
        await db.refresh(inv)
        imported += 1

    return InvoiceImportResult(imported=imported, skipped=skipped, errors=errors)
