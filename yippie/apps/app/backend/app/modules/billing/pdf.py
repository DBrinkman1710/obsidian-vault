"""EU/NL-compliant invoice PDF generator using fpdf2."""
from __future__ import annotations

from collections import defaultdict
from datetime import date
from typing import TYPE_CHECKING

from fpdf import FPDF

if TYPE_CHECKING:
    from app.core.models import Tenant
    from app.modules.billing.models import Invoice
    from app.modules.contacts.models import Contact


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = h[0] * 2 + h[1] * 2 + h[2] * 2
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _fmt_cents(cents: int, currency: str = "EUR") -> str:
    # Use "EUR " instead of "€" — Helvetica only covers Latin-1 (no euro sign)
    symbol = "EUR " if currency == "EUR" else currency + " "
    return f"{symbol}{cents / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _fmt_date(d: date | None) -> str:
    if d is None:
        return "-"  # em dash not in Latin-1; use plain hyphen
    return d.strftime("%d-%m-%Y")


def _vat_breakdown(line_items: list[dict]) -> dict[int, dict[str, int]]:
    groups: dict[int, dict[str, int]] = defaultdict(lambda: {"subtotal": 0, "vat": 0})
    for item in line_items:
        rate = int(item.get("tax_rate_pct", 21))
        qty = int(item.get("quantity", 1))
        price = int(item.get("unit_price_cents", 0))
        line_excl = qty * price
        line_vat = round(line_excl * rate / 100)
        groups[rate]["subtotal"] += line_excl
        groups[rate]["vat"] += line_vat
    return dict(groups)


def generate_invoice_pdf(
    invoice: "Invoice",
    tenant: "Tenant",
    contact: "Contact | None",
) -> bytes:
    brand_r, brand_g, brand_b = _hex_to_rgb(getattr(tenant, "primary_color", "#5BA4F5") or "#5BA4F5")
    currency = invoice.currency or "EUR"

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(left=15, top=15, right=15)
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    page_w = 180  # usable width (210 - 2×15)

    # ── Accent bar ────────────────────────────────────────────────────────────
    pdf.set_fill_color(brand_r, brand_g, brand_b)
    pdf.rect(15, 15, page_w, 3, style="F")

    # ── Header: left = sender, right = invoice meta ───────────────────────────
    y_start = 22
    pdf.set_xy(15, y_start)

    # Sender block (left, 90mm wide)
    pdf.set_font("Helvetica", style="B", size=13)
    pdf.set_text_color(30, 30, 30)
    pdf.cell(90, 7, tenant.name or "", ln=0)

    # Invoice title (right)
    pdf.set_font("Helvetica", style="B", size=18)
    pdf.set_text_color(brand_r, brand_g, brand_b)
    pdf.cell(90, 7, "FACTUUR", ln=1, align="R")

    pdf.set_text_color(60, 60, 60)
    pdf.set_font("Helvetica", size=9)

    # Collect sender lines
    sender_lines = []
    if tenant.street_address:
        sender_lines.append(tenant.street_address)
    if tenant.postal_code or tenant.city:
        sender_lines.append(f"{tenant.postal_code or ''} {tenant.city or ''}".strip())
    if tenant.country and tenant.country != "Nederland":
        sender_lines.append(tenant.country)
    if tenant.phone:
        sender_lines.append(tenant.phone)
    if tenant.kvk_nummer:
        sender_lines.append(f"KvK: {tenant.kvk_nummer}")
    if tenant.btw_nummer:
        sender_lines.append(f"BTW: {tenant.btw_nummer}")
    if tenant.iban:
        sender_lines.append(f"IBAN: {tenant.iban}")

    # Meta lines (right column)
    inv_date = invoice.invoice_date or (invoice.created_at.date() if invoice.created_at else None)
    meta_lines = [
        ("Factuurnummer", invoice.invoice_number),
        ("Factuurdatum", _fmt_date(inv_date)),
        ("Vervaldatum", _fmt_date(invoice.due_date)),
    ]

    max_left_lines = max(len(sender_lines), len(meta_lines))
    for i in range(max_left_lines):
        y_cur = y_start + 10 + i * 5
        pdf.set_xy(15, y_cur)
        if i < len(sender_lines):
            pdf.set_font("Helvetica", size=9)
            pdf.cell(90, 5, sender_lines[i], ln=0)
        else:
            pdf.cell(90, 5, "", ln=0)

        if i < len(meta_lines):
            label, value = meta_lines[i]
            pdf.set_xy(105, y_cur)
            pdf.set_font("Helvetica", size=9)
            pdf.cell(40, 5, label, ln=0, align="L")
            pdf.set_font("Helvetica", style="B", size=9)
            pdf.cell(50, 5, value, ln=0, align="R")

    # ── Separator line ────────────────────────────────────────────────────────
    y_after_header = y_start + 12 + max_left_lines * 5
    pdf.set_draw_color(200, 200, 200)
    pdf.line(15, y_after_header, 195, y_after_header)

    # ── Bill To ──────────────────────────────────────────────────────────────
    y_bill = y_after_header + 5
    pdf.set_xy(15, y_bill)
    pdf.set_font("Helvetica", style="B", size=8)
    pdf.set_text_color(120, 120, 120)
    pdf.cell(90, 5, "FACTUUR AAN", ln=1)

    pdf.set_text_color(30, 30, 30)
    pdf.set_font("Helvetica", style="B", size=10)
    contact_name = getattr(invoice, "contact_name", None) or (contact.full_name if contact else "")
    pdf.set_x(15)
    pdf.cell(90, 5, contact_name, ln=1)

    if contact:
        company_name = getattr(contact, "company_name", None)
        if company_name and company_name != contact_name:
            pdf.set_font("Helvetica", size=9)
            pdf.set_x(15)
            pdf.cell(90, 5, company_name, ln=1)

    # ── Line items table ──────────────────────────────────────────────────────
    y_table = pdf.get_y() + 8

    col_desc = 82
    col_qty = 18
    col_price = 28
    col_vat = 18
    col_total = 34

    # Table header
    pdf.set_xy(15, y_table)
    pdf.set_fill_color(brand_r, brand_g, brand_b)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", style="B", size=8)
    pdf.cell(col_desc, 7, "Omschrijving", fill=True, ln=0, align="L")
    pdf.cell(col_qty, 7, "Aantal", fill=True, ln=0, align="C")
    pdf.cell(col_price, 7, "Prijs excl.", fill=True, ln=0, align="R")
    pdf.cell(col_vat, 7, "BTW %", fill=True, ln=0, align="C")
    pdf.cell(col_total, 7, "Bedrag excl.", fill=True, ln=1, align="R")

    # Table rows
    pdf.set_text_color(30, 30, 30)
    pdf.set_font("Helvetica", size=9)
    for i, item in enumerate(invoice.line_items or []):
        desc = str(item.get("description", ""))
        qty = int(item.get("quantity", 1))
        unit_price = int(item.get("unit_price_cents", 0))
        rate = int(item.get("tax_rate_pct", 21))
        line_excl = qty * unit_price

        fill_color = (248, 249, 251) if i % 2 == 1 else (255, 255, 255)
        pdf.set_fill_color(*fill_color)

        # Use multi_cell for description to handle long text, then position others manually
        x_start = 15
        row_h = 6
        y_row = pdf.get_y()

        pdf.set_xy(x_start, y_row)
        pdf.cell(col_desc, row_h, desc[:60], fill=True, ln=0, align="L")
        pdf.cell(col_qty, row_h, str(qty), fill=True, ln=0, align="C")
        pdf.cell(col_price, row_h, _fmt_cents(unit_price, currency), fill=True, ln=0, align="R")
        pdf.cell(col_vat, row_h, f"{rate}%", fill=True, ln=0, align="C")
        pdf.cell(col_total, row_h, _fmt_cents(line_excl, currency), fill=True, ln=1, align="R")

    # ── Totals ────────────────────────────────────────────────────────────────
    y_totals = pdf.get_y() + 5
    breakdown = _vat_breakdown(invoice.line_items or [])
    subtotal = sum(v["subtotal"] for v in breakdown.values())
    total_vat = sum(v["vat"] for v in breakdown.values())
    total_incl = subtotal + total_vat

    label_x = 110
    value_x = 155
    value_w = 40
    row_h = 6

    pdf.set_draw_color(200, 200, 200)
    pdf.line(label_x, y_totals - 2, 195, y_totals - 2)

    y_cur = y_totals
    pdf.set_font("Helvetica", size=9)
    pdf.set_text_color(60, 60, 60)
    pdf.set_xy(label_x, y_cur)
    pdf.cell(value_x - label_x, row_h, "Subtotaal excl. BTW", ln=0)
    pdf.set_xy(value_x, y_cur)
    pdf.cell(value_w, row_h, _fmt_cents(subtotal, currency), ln=1, align="R")

    for rate_pct in sorted(breakdown.keys()):
        vat_amt = breakdown[rate_pct]["vat"]
        y_cur = pdf.get_y()
        pdf.set_xy(label_x, y_cur)
        label = f"BTW {rate_pct}%" if rate_pct > 0 else "BTW vrijgesteld (0%)"
        pdf.cell(value_x - label_x, row_h, label, ln=0)
        pdf.set_xy(value_x, y_cur)
        pdf.cell(value_w, row_h, _fmt_cents(vat_amt, currency), ln=1, align="R")

    # Total line
    y_cur = pdf.get_y() + 1
    pdf.set_fill_color(brand_r, brand_g, brand_b)
    pdf.rect(label_x, y_cur, 195 - label_x, 8, style="F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", style="B", size=10)
    pdf.set_xy(label_x, y_cur + 1)
    pdf.cell(value_x - label_x, 6, "Totaal incl. BTW", ln=0)
    pdf.set_xy(value_x, y_cur + 1)
    pdf.cell(value_w, 6, _fmt_cents(total_incl, currency), ln=1, align="R")

    # ── Notes ─────────────────────────────────────────────────────────────────
    if invoice.notes:
        y_notes = pdf.get_y() + 8
        pdf.set_xy(15, y_notes)
        pdf.set_text_color(60, 60, 60)
        pdf.set_font("Helvetica", style="B", size=8)
        pdf.cell(page_w, 5, "BETALINGSINFORMATIE", ln=1)
        pdf.set_font("Helvetica", size=9)
        pdf.set_x(15)
        pdf.multi_cell(page_w, 5, invoice.notes)

    # ── Footer ────────────────────────────────────────────────────────────────
    pdf.set_y(-18)
    pdf.set_font("Helvetica", size=7)
    pdf.set_text_color(160, 160, 160)
    pdf.cell(page_w, 5, f"Gegenereerd met Yippie  ·  {tenant.name or ''}", align="C")

    return bytes(pdf.output())
