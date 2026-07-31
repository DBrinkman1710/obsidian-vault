"""Shared fpdf2 renderer for block based document templates ([TMPL1]).

Draws a BlockDocument (app/core/doc_blocks.py) onto an A4 page. The drawing
code is lifted from billing/pdf.py (sender block, line items table, totals) and
contracts/pdf.py (paragraphs, signature audit block) — those legacy renderers
stay untouched as the fallback for documents without a block template.

Everything passes through _latin1(): Helvetica only covers Latin-1, so
non ASCII degrades instead of crashing, and currency prints as "EUR " (no
euro sign in the font).
"""
from __future__ import annotations

import base64
import io
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any

from fpdf import FPDF

from app.core.doc_blocks import BlockDocument

PAGE_W = 180  # usable width (210 − 2×15)
MARGIN = 15


def _hex_to_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    if len(h) == 3:
        h = h[0] * 2 + h[1] * 2 + h[2] * 2
    return int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)


def _latin1(text: str) -> str:
    return text.encode("latin-1", "replace").decode("latin-1")


def _fmt_cents(cents: int, currency: str = "EUR") -> str:
    symbol = "EUR " if currency == "EUR" else currency + " "
    return f"{symbol}{cents / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def _vat_breakdown(line_items: list[dict], reverse_charge: bool = False) -> dict[int, dict[str, int]]:
    groups: dict[int, dict[str, int]] = defaultdict(lambda: {"subtotal": 0, "vat": 0})
    for item in line_items:
        # Under BTW verlegd the supplier charges no VAT at all.
        rate = 0 if reverse_charge else int(item.get("tax_rate_pct", 21))
        qty = int(item.get("quantity", 1))
        price = int(item.get("unit_price_cents", 0))
        line_excl = qty * price
        groups[rate]["subtotal"] += line_excl
        groups[rate]["vat"] += round(line_excl * rate / 100)
    return dict(groups)


_SIG_DATA_URL_RE = re.compile(r"^data:image/png;base64,(?P<b64>[A-Za-z0-9+/=]+)$")


@dataclass
class SignatureData:
    signed_at: datetime | None = None
    signer_name: str | None = None
    signer_ip: str | None = None
    signature_image: str | None = None  # PNG data URL


@dataclass
class RenderContext:
    doc_type: str  # "contract" | "invoice"
    tenant: Any = None  # Tenant ORM row or None — read via getattr
    tenant_name: str = ""
    primary_color: str | None = None
    currency: str = "EUR"
    line_items: list[dict] = field(default_factory=list)  # invoice: live data
    meta_lines: list[tuple[str, str]] = field(default_factory=list)  # logo_header right column
    notes: str | None = None  # the document's own notes field
    signature: SignatureData | None = None  # contract
    # BTW verlegd: zeroes every line's VAT and switches the totals wording.
    reverse_charge: bool = False
    # Sender/recipient as frozen at issue time. seller_lines overrides the live
    # tenant row; client_lines drives the mandatory "FACTUUR AAN" block, which
    # has no block type of its own and is drawn with the header.
    seller_lines: list[str] | None = None
    client_lines: list[str] = field(default_factory=list)
    # Printed under the totals when reverse_charge is set; carries the client's
    # VAT number, which the statement is legally required to name.
    reverse_charge_statement: str = "BTW verlegd"


def render_blocks_pdf(doc: BlockDocument, ctx: RenderContext) -> bytes:
    """Draw a resolved block document. Text configs must already be merge
    resolved (resolve_merge_fields_in_blocks) — this function only draws."""
    brand = _hex_to_rgb(ctx.primary_color or "#5BA4F5")

    pdf = FPDF(orientation="P", unit="mm", format="A4")
    pdf.set_margins(left=MARGIN, top=MARGIN, right=MARGIN)
    pdf.set_auto_page_break(auto=True, margin=20)
    pdf.add_page()

    footer_text: str | None = None
    has_signature_block = False

    for block in doc.blocks:
        cfg = block.config
        if block.type == "logo_header":
            _render_logo_header(pdf, cfg, ctx, brand)
        elif block.type == "heading":
            _render_heading(pdf, cfg, brand)
        elif block.type == "text":
            _render_text(pdf, cfg)
        elif block.type == "divider":
            _render_divider(pdf, cfg)
        elif block.type == "line_items":
            _render_line_items(pdf, cfg, ctx, brand)
        elif block.type == "totals":
            _render_totals(pdf, cfg, ctx, brand)
        elif block.type == "notes":
            _render_notes(pdf, cfg, ctx)
        elif block.type == "footer":
            footer_text = cfg.get("text") or footer_text
        elif block.type == "signature":
            has_signature_block = True
            _render_signature(pdf, cfg, ctx.signature, brand)
        # Unknown block types are skipped — forward compatibility.

    # A signed contract's audit trail must always print, even when the frozen
    # layout predates the signature block or the user removed it.
    if ctx.signature and ctx.signature.signed_at and not has_signature_block:
        _render_signature(pdf, {"show_date": True, "show_ip": True}, ctx.signature, brand)

    if footer_text:
        pdf.set_y(-18)
        pdf.set_font("Helvetica", size=7)
        pdf.set_text_color(160, 160, 160)
        pdf.cell(PAGE_W, 5, _latin1(footer_text), align="C")

    return bytes(pdf.output())


# ── Block renderers ────────────────────────────────────────────────────────────

def _render_logo_header(pdf: FPDF, cfg: dict, ctx: RenderContext, brand: tuple[int, int, int]) -> None:
    tenant = ctx.tenant
    pdf.set_fill_color(*brand)
    pdf.rect(MARGIN, pdf.get_y(), PAGE_W, 3, style="F")
    y_start = pdf.get_y() + 7
    pdf.set_xy(MARGIN, y_start)

    if cfg.get("show_logo", True):
        pdf.set_font("Helvetica", style="B", size=13)
        pdf.set_text_color(30, 30, 30)
        pdf.cell(90, 7, _latin1(ctx.tenant_name), ln=0)
    if cfg.get("title"):
        pdf.set_font("Helvetica", style="B", size=18)
        pdf.set_text_color(*brand)
        pdf.set_xy(MARGIN + 90, y_start)
        pdf.cell(90, 7, _latin1(cfg["title"]), ln=0, align="R")
    pdf.set_xy(MARGIN, y_start + 7)

    sender_lines: list[str] = []
    if ctx.seller_lines is not None:
        # Frozen at issue time — reprinting must not pick up a later address.
        sender_lines = list(ctx.seller_lines)
    elif cfg.get("show_address", True) and tenant is not None:
        if getattr(tenant, "street_address", None):
            sender_lines.append(tenant.street_address)
        postal = getattr(tenant, "postal_code", None)
        city = getattr(tenant, "city", None)
        if postal or city:
            sender_lines.append(f"{postal or ''} {city or ''}".strip())
        country = getattr(tenant, "country", None)
        if country and country != "Nederland":
            sender_lines.append(country)
        if getattr(tenant, "phone", None):
            sender_lines.append(tenant.phone)
    if ctx.seller_lines is None and cfg.get("show_kvk_btw", True) and tenant is not None:
        if getattr(tenant, "kvk_nummer", None):
            sender_lines.append(f"KvK: {tenant.kvk_nummer}")
        if getattr(tenant, "btw_nummer", None):
            sender_lines.append(f"BTW: {tenant.btw_nummer}")
    if (
        ctx.seller_lines is None
        and cfg.get("show_iban", True)
        and tenant is not None
        and getattr(tenant, "iban", None)
    ):
        sender_lines.append(f"IBAN: {tenant.iban}")

    meta_lines = ctx.meta_lines
    pdf.set_text_color(60, 60, 60)
    rows = max(len(sender_lines), len(meta_lines))
    y_top = pdf.get_y()
    for i in range(rows):
        y_cur = y_top + i * 5
        if i < len(sender_lines):
            pdf.set_xy(MARGIN, y_cur)
            pdf.set_font("Helvetica", size=9)
            pdf.cell(90, 5, _latin1(sender_lines[i]), ln=0)
        if i < len(meta_lines):
            label, value = meta_lines[i]
            pdf.set_xy(MARGIN + 90, y_cur)
            pdf.set_font("Helvetica", size=9)
            pdf.cell(40, 5, _latin1(label), ln=0, align="L")
            pdf.set_font("Helvetica", style="B", size=9)
            pdf.cell(50, 5, _latin1(value), ln=0, align="R")
    pdf.set_xy(MARGIN, y_top + rows * 5 + 4)

    # The recipient's name and address are mandatory on an invoice but have no
    # block of their own, so they are drawn here rather than left to whether the
    # tenant happened to add them to their template.
    if ctx.doc_type == "invoice" and ctx.client_lines:
        pdf.ln(2)
        pdf.set_x(MARGIN)
        pdf.set_font("Helvetica", style="B", size=8)
        pdf.set_text_color(120, 120, 120)
        pdf.cell(90, 5, "FACTUUR AAN", ln=1)
        pdf.set_text_color(30, 30, 30)
        for i, line in enumerate(ctx.client_lines):
            pdf.set_x(MARGIN)
            pdf.set_font("Helvetica", style="B" if i == 0 else "", size=10 if i == 0 else 9)
            pdf.cell(90, 5, _latin1(line), ln=1)
        pdf.ln(2)


def _render_heading(pdf: FPDF, cfg: dict, brand: tuple[int, int, int]) -> None:
    text = cfg.get("text") or ""
    if not text:
        return
    level = int(cfg.get("level", 1))
    pdf.set_text_color(20, 24, 33)
    pdf.set_font("Helvetica", "B", 17 if level == 1 else 13)
    pdf.set_x(MARGIN)
    pdf.multi_cell(0, 8 if level == 1 else 6.5, _latin1(text), align=_align(cfg))
    pdf.ln(2)


def _render_text(pdf: FPDF, cfg: dict) -> None:
    text = cfg.get("text") or ""
    if not text:
        return
    size = 8.5 if cfg.get("size") == "sm" else 10
    pdf.set_font("Helvetica", "", size)
    pdf.set_text_color(40, 44, 52)
    for paragraph in text.split("\n"):
        pdf.set_x(MARGIN)
        if paragraph.strip():
            pdf.multi_cell(0, 5.5, _latin1(paragraph), align=_align(cfg))
        else:
            pdf.ln(3)
    pdf.ln(2)


def _align(cfg: dict) -> str:
    return {"left": "L", "center": "C", "right": "R"}.get(cfg.get("align", "left"), "L")


def _render_divider(pdf: FPDF, cfg: dict) -> None:
    if cfg.get("style") == "space":
        pdf.ln(6)
        return
    pdf.ln(2)
    y = pdf.get_y()
    pdf.set_draw_color(200, 200, 200)
    pdf.set_line_width(0.2)
    pdf.line(MARGIN, y, MARGIN + PAGE_W, y)
    pdf.ln(4)


def _render_line_items(pdf: FPDF, cfg: dict, ctx: RenderContext, brand: tuple[int, int, int]) -> None:
    show_vat = cfg.get("show_vat_column", True)
    zebra = cfg.get("zebra", True)
    currency = ctx.currency

    col_qty, col_price, col_total = 18, 28, 34
    col_vat = 18 if show_vat else 0
    col_desc = PAGE_W - col_qty - col_price - col_vat - col_total

    pdf.ln(2)
    pdf.set_x(MARGIN)
    pdf.set_fill_color(*brand)
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", style="B", size=8)
    pdf.cell(col_desc, 7, "Omschrijving", fill=True, ln=0, align="L")
    pdf.cell(col_qty, 7, "Aantal", fill=True, ln=0, align="C")
    pdf.cell(col_price, 7, "Prijs excl.", fill=True, ln=0, align="R")
    if show_vat:
        pdf.cell(col_vat, 7, "BTW %", fill=True, ln=0, align="C")
    pdf.cell(col_total, 7, "Bedrag excl.", fill=True, ln=1, align="R")

    pdf.set_text_color(30, 30, 30)
    pdf.set_font("Helvetica", size=9)
    for i, item in enumerate(ctx.line_items or []):
        desc = str(item.get("description", ""))
        qty = int(item.get("quantity", 1))
        unit_price = int(item.get("unit_price_cents", 0))
        rate = 0 if ctx.reverse_charge else int(item.get("tax_rate_pct", 21))
        line_excl = qty * unit_price

        fill_color = (248, 249, 251) if (zebra and i % 2 == 1) else (255, 255, 255)
        pdf.set_fill_color(*fill_color)
        pdf.set_x(MARGIN)
        pdf.cell(col_desc, 6, _latin1(desc[:60]), fill=True, ln=0, align="L")
        pdf.cell(col_qty, 6, str(qty), fill=True, ln=0, align="C")
        pdf.cell(col_price, 6, _fmt_cents(unit_price, currency), fill=True, ln=0, align="R")
        if show_vat:
            pdf.cell(col_vat, 6, f"{rate}%", fill=True, ln=0, align="C")
        pdf.cell(col_total, 6, _fmt_cents(line_excl, currency), fill=True, ln=1, align="R")
    pdf.ln(2)


def _render_totals(pdf: FPDF, cfg: dict, ctx: RenderContext, brand: tuple[int, int, int]) -> None:
    currency = ctx.currency
    breakdown = _vat_breakdown(ctx.line_items or [], ctx.reverse_charge)
    subtotal = sum(v["subtotal"] for v in breakdown.values())
    total_vat = sum(v["vat"] for v in breakdown.values())
    total_incl = subtotal + total_vat

    label_x = MARGIN + 95  # 110
    value_x = MARGIN + 140  # 155
    value_w = 40
    row_h = 6

    y_totals = pdf.get_y() + 3
    pdf.set_draw_color(200, 200, 200)
    pdf.line(label_x, y_totals - 2, MARGIN + PAGE_W, y_totals - 2)

    pdf.set_font("Helvetica", size=9)
    pdf.set_text_color(60, 60, 60)
    pdf.set_xy(label_x, y_totals)
    pdf.cell(value_x - label_x, row_h, "Subtotaal excl. BTW", ln=0)
    pdf.set_xy(value_x, y_totals)
    pdf.cell(value_w, row_h, _fmt_cents(subtotal, currency), ln=1, align="R")

    if cfg.get("show_vat_breakdown", True):
        for rate_pct in sorted(breakdown.keys()):
            y_cur = pdf.get_y()
            pdf.set_xy(label_x, y_cur)
            if ctx.reverse_charge:
                # Reverse charge is not an exemption — "vrijgesteld" would be
                # the wrong legal statement.
                label = "BTW verlegd (0%)"
            elif rate_pct > 0:
                label = f"BTW {rate_pct}%"
            else:
                label = "BTW vrijgesteld (0%)"
            pdf.cell(value_x - label_x, row_h, label, ln=0)
            pdf.set_xy(value_x, y_cur)
            pdf.cell(value_w, row_h, _fmt_cents(breakdown[rate_pct]["vat"], currency), ln=1, align="R")
    else:
        y_cur = pdf.get_y()
        pdf.set_xy(label_x, y_cur)
        pdf.cell(value_x - label_x, row_h, "BTW", ln=0)
        pdf.set_xy(value_x, y_cur)
        pdf.cell(value_w, row_h, _fmt_cents(total_vat, currency), ln=1, align="R")

    y_cur = pdf.get_y() + 1
    pdf.set_fill_color(*brand)
    pdf.rect(label_x, y_cur, MARGIN + PAGE_W - label_x, 8, style="F")
    pdf.set_text_color(255, 255, 255)
    pdf.set_font("Helvetica", style="B", size=10)
    pdf.set_xy(label_x, y_cur + 1)
    pdf.cell(value_x - label_x, 6, "Totaal incl. BTW", ln=0)
    pdf.set_xy(value_x, y_cur + 1)
    pdf.cell(value_w, 6, _fmt_cents(total_incl, currency), ln=1, align="R")
    pdf.ln(3)

    # Mandatory wording on a reverse charge invoice.
    if ctx.reverse_charge:
        pdf.set_x(MARGIN)
        pdf.set_text_color(30, 30, 30)
        pdf.set_font("Helvetica", style="B", size=9)
        pdf.multi_cell(PAGE_W, 5, _latin1(ctx.reverse_charge_statement))
        pdf.set_font("Helvetica", size=8)
        pdf.set_text_color(90, 90, 90)
        pdf.set_x(MARGIN)
        pdf.multi_cell(PAGE_W, 4, "VAT reverse charged to the recipient.")
        pdf.ln(2)


def _render_notes(pdf: FPDF, cfg: dict, ctx: RenderContext) -> None:
    text = cfg.get("text") if cfg.get("source") == "custom" else ctx.notes
    if not text:
        return
    pdf.ln(4)
    pdf.set_x(MARGIN)
    pdf.set_text_color(60, 60, 60)
    if cfg.get("label"):
        pdf.set_font("Helvetica", style="B", size=8)
        pdf.cell(PAGE_W, 5, _latin1(cfg["label"]), ln=1)
    pdf.set_font("Helvetica", size=9)
    pdf.set_x(MARGIN)
    pdf.multi_cell(PAGE_W, 5, _latin1(text))
    pdf.ln(2)


def _render_signature(
    pdf: FPDF, cfg: dict, signature: SignatureData | None, brand: tuple[int, int, int]
) -> None:
    pdf.ln(8)
    pdf.set_draw_color(*brand)
    pdf.set_line_width(0.4)
    y = pdf.get_y()
    pdf.line(MARGIN, y, MARGIN + 72, y)
    pdf.ln(3)

    if not signature or not signature.signed_at:
        # Unsigned: a placeholder so the counterparty sees where to sign.
        pdf.set_font("Helvetica", "", 8.5)
        pdf.set_text_color(110, 116, 128)
        pdf.set_x(MARGIN)
        pdf.cell(0, 4.5, "Handtekening", ln=1)
        return

    if signature.signature_image:
        match = _SIG_DATA_URL_RE.match(signature.signature_image)
        if match:
            try:
                png = base64.b64decode(match.group("b64"))
                pdf.image(io.BytesIO(png), w=45)
                pdf.ln(2)
            except Exception:
                pass  # a corrupt drawing must never block the PDF

    pdf.set_font("Helvetica", "B", 10)
    pdf.set_text_color(20, 24, 33)
    pdf.set_x(MARGIN)
    pdf.cell(0, 5.5, _latin1(f"Signed by {signature.signer_name or '-'}"), ln=1)
    pdf.set_font("Helvetica", "", 8.5)
    pdf.set_text_color(110, 116, 128)
    if cfg.get("show_date", True):
        signed = signature.signed_at.strftime("%d-%m-%Y %H:%M UTC")
        pdf.set_x(MARGIN)
        pdf.cell(0, 4.5, _latin1(f"Date: {signed}"), ln=1)
    if cfg.get("show_ip", True) and signature.signer_ip:
        pdf.set_x(MARGIN)
        pdf.cell(0, 4.5, _latin1(f"IP address: {signature.signer_ip}"), ln=1)
