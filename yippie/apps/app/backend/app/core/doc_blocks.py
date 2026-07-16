"""Block based document templates ([TMPL1]) — schema, validation, merge fields.

One JSON shape powers both contract and invoice templates:

    {"version": 1, "blocks": [{"id": "b_9f2c", "type": "text", "config": {...}}, ...]}

Shared blocks work for both document types; line_items/totals are invoice only
and signature is contract only. The builder UI (TMPL2) drags these blocks into
a vertical stack; app/core/doc_blocks_pdf.py draws them with fpdf2.

Merge fields keep the [CONTRACT3] grammar: {{field.name}}, unknown fields
render as "…" so a typo is visible in the preview instead of leaking the raw
placeholder.
"""
from __future__ import annotations

import copy
import re
import uuid
from datetime import date, timedelta
from typing import TYPE_CHECKING, Literal

from pydantic import BaseModel, Field, ValidationError

if TYPE_CHECKING:
    from app.core.models import Tenant
    from app.modules.billing.models import Invoice
    from app.modules.contacts.models import Contact

SCHEMA_VERSION = 1

SHARED_BLOCKS = ("logo_header", "heading", "text", "divider", "notes", "footer")
INVOICE_ONLY_BLOCKS = ("line_items", "totals")
CONTRACT_ONLY_BLOCKS = ("signature",)

DocType = Literal["contract", "invoice"]


def allowed_block_types(doc_type: str) -> tuple[str, ...]:
    if doc_type == "invoice":
        return SHARED_BLOCKS + INVOICE_ONLY_BLOCKS
    if doc_type == "contract":
        return SHARED_BLOCKS + CONTRACT_ONLY_BLOCKS
    raise ValueError(f"Unknown doc_type: {doc_type}")


# ── Per block config models — coerce and drop unknown keys on save ────────────

class LogoHeaderConfig(BaseModel):
    # Renders the tenant sender block (name + address/KvK/BTW/IBAN toggles) with
    # an optional brand colored title on the right (e.g. "FACTUUR"). For
    # invoices the right column also carries the number/date meta lines.
    title: str = ""
    show_logo: bool = True  # tenant name in brand color (image logos later)
    show_address: bool = True
    show_kvk_btw: bool = True
    show_iban: bool = True


class HeadingConfig(BaseModel):
    text: str = ""
    level: int = Field(1, ge=1, le=2)
    align: Literal["left", "center", "right"] = "left"


class TextConfig(BaseModel):
    text: str = ""
    size: Literal["sm", "md"] = "md"
    align: Literal["left", "center", "right"] = "left"


class DividerConfig(BaseModel):
    style: Literal["line", "space"] = "line"


class NotesConfig(BaseModel):
    label: str = ""
    # document = the invoice's/contract's own notes field; custom = fixed text.
    source: Literal["document", "custom"] = "document"
    text: str = ""


class FooterConfig(BaseModel):
    text: str = ""


class LineItemsConfig(BaseModel):
    zebra: bool = True
    show_vat_column: bool = True


class TotalsConfig(BaseModel):
    show_vat_breakdown: bool = True


class SignatureConfig(BaseModel):
    show_date: bool = True
    show_ip: bool = True


_CONFIG_MODELS: dict[str, type[BaseModel]] = {
    "logo_header": LogoHeaderConfig,
    "heading": HeadingConfig,
    "text": TextConfig,
    "divider": DividerConfig,
    "notes": NotesConfig,
    "footer": FooterConfig,
    "line_items": LineItemsConfig,
    "totals": TotalsConfig,
    "signature": SignatureConfig,
}

_BLOCK_ID_RE = re.compile(r"^[A-Za-z0-9_]{1,40}$")


class Block(BaseModel):
    id: str
    type: str
    config: dict = Field(default_factory=dict)


class BlockDocument(BaseModel):
    version: int = SCHEMA_VERSION
    blocks: list[Block] = Field(default_factory=list)


def new_block_id() -> str:
    return f"b_{uuid.uuid4().hex[:8]}"


def validate_blocks(raw: dict, doc_type: str, *, max_blocks: int = 60) -> BlockDocument:
    """Parse + validate a raw blocks payload for a document type.

    Raises ValueError with a user readable message on anything invalid. Configs
    are round tripped through their Pydantic model so unknown keys are dropped
    and values are coerced before storage.
    """
    allowed = allowed_block_types(doc_type)
    try:
        doc = BlockDocument.model_validate(raw)
    except ValidationError as exc:
        raise ValueError(f"Invalid blocks payload: {exc.errors()[0].get('msg', 'parse error')}") from exc

    if len(doc.blocks) > max_blocks:
        raise ValueError(f"Too many blocks (max {max_blocks})")

    seen_ids: set[str] = set()
    for block in doc.blocks:
        if block.type not in allowed:
            raise ValueError(f"Block type '{block.type}' is not available for {doc_type} templates")
        if not _BLOCK_ID_RE.match(block.id):
            block.id = new_block_id()
        if block.id in seen_ids:
            block.id = new_block_id()
        seen_ids.add(block.id)
        model = _CONFIG_MODELS[block.type]
        try:
            block.config = model.model_validate(block.config).model_dump()
        except ValidationError as exc:
            raise ValueError(
                f"Invalid config for '{block.type}' block: {exc.errors()[0].get('msg', 'invalid value')}"
            ) from exc

    doc.version = SCHEMA_VERSION
    return doc


# Config keys that carry user text with merge fields, per block type.
_TEXT_KEYS: dict[str, tuple[str, ...]] = {
    "logo_header": ("title",),
    "heading": ("text",),
    "text": ("text",),
    "notes": ("label", "text"),
    "footer": ("text",),
}


def flatten_blocks_to_text(doc: BlockDocument) -> str:
    """Plain text projection of a block document — the ContractTemplate.body
    compatibility path (sign page, search, legacy PDF fallback)."""
    parts: list[str] = []
    for block in doc.blocks:
        if block.type == "heading" and block.config.get("text"):
            parts.append(block.config["text"])
        elif block.type == "text" and block.config.get("text"):
            parts.append(block.config["text"])
        elif block.type == "notes" and block.config.get("source") == "custom" and block.config.get("text"):
            label = block.config.get("label")
            parts.append(f"{label}\n{block.config['text']}" if label else block.config["text"])
    return "\n\n".join(parts)


def render_text_merge_fields(text: str, values: dict[str, str]) -> str:
    """Replace {{merge.fields}} — unknown fields become "…" (same as [CONTRACT3])."""
    return _FIELD_RE.sub(lambda m: values.get(m.group(1), "…"), text)


def resolve_merge_fields_in_blocks(doc: BlockDocument, values: dict[str, str]) -> BlockDocument:
    """Deep copy with every text bearing config key merge resolved."""
    resolved = copy.deepcopy(doc)
    for block in resolved.blocks:
        for key in _TEXT_KEYS.get(block.type, ()):
            if block.config.get(key):
                block.config[key] = render_text_merge_fields(block.config[key], values)
    return resolved


def body_text_to_blocks(body: str) -> dict:
    """Wrap a plain text body into the single text block shape the migration
    uses — runtime guard for templates that predate [TMPL1]."""
    return {
        "version": SCHEMA_VERSION,
        "blocks": [
            {
                "id": new_block_id(),
                "type": "text",
                "config": {"text": body, "size": "md", "align": "left"},
            }
        ],
    }


# ── Merge fields ───────────────────────────────────────────────────────────────

_FIELD_RE = re.compile(r"\{\{\s*([a-z_.]+)\s*\}\}")

# Canonical registry — contracts/service.py re-exports this as MERGE_FIELDS.
CONTRACT_MERGE_FIELDS = (
    "contract.title", "contract.type", "contract.start_date", "contract.end_date",
    "contract.notice_period_days", "contract.value",
    "company.name", "contact.name", "contact.email", "tenant.name", "date.today",
)

INVOICE_MERGE_FIELDS = (
    "invoice.number", "invoice.date", "invoice.due_date",
    "invoice.subtotal", "invoice.vat_total", "invoice.total",
    "contact.name", "contact.email", "company.name",
    "tenant.name", "tenant.iban", "tenant.kvk", "tenant.btw", "date.today",
)


def _fmt_merge_date(d: date | None) -> str:
    return d.strftime("%d-%m-%Y") if d else "…"


def _fmt_cents_merge(cents: int, currency: str = "EUR") -> str:
    # Same Dutch formatting as the PDF renderers; "EUR " because Helvetica
    # (Latin-1) has no euro sign.
    symbol = "EUR " if currency == "EUR" else currency + " "
    return f"{symbol}{cents / 100:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")


def invoice_merge_values(
    invoice: "Invoice", tenant: "Tenant | None", contact: "Contact | None"
) -> dict[str, str]:
    currency = invoice.currency or "EUR"
    inv_date = invoice.invoice_date or (invoice.created_at.date() if invoice.created_at else None)
    company_name = getattr(contact, "company_name", None) if contact else None
    return {
        "invoice.number": invoice.invoice_number or "…",
        "invoice.date": _fmt_merge_date(inv_date),
        "invoice.due_date": _fmt_merge_date(invoice.due_date),
        "invoice.subtotal": _fmt_cents_merge(invoice.subtotal_cents or 0, currency),
        "invoice.vat_total": _fmt_cents_merge(invoice.tax_cents or 0, currency),
        "invoice.total": _fmt_cents_merge(invoice.total_cents or 0, currency),
        "contact.name": (contact.full_name if contact else None) or "…",
        "contact.email": (contact.email if contact else None) or "…",
        "company.name": company_name or "…",
        "tenant.name": (tenant.name if tenant else None) or "…",
        "tenant.iban": (getattr(tenant, "iban", None) if tenant else None) or "…",
        "tenant.kvk": (getattr(tenant, "kvk_nummer", None) if tenant else None) or "…",
        "tenant.btw": (getattr(tenant, "btw_nummer", None) if tenant else None) or "…",
        "date.today": _fmt_merge_date(date.today()),
    }


# ── Sample contexts for the template preview endpoints ────────────────────────

SAMPLE_LINE_ITEMS = [
    {"description": "Consultancy", "quantity": 8, "unit_price_cents": 9500, "tax_rate_pct": 21},
    {"description": "Hosting en onderhoud", "quantity": 1, "unit_price_cents": 4900, "tax_rate_pct": 21},
    {"description": "Trainingsmateriaal", "quantity": 3, "unit_price_cents": 1250, "tax_rate_pct": 9},
]


def sample_contract_values(tenant_name: str) -> dict[str, str]:
    today = date.today()
    return {
        "contract.title": "Service agreement",
        "contract.type": "Service",
        "contract.start_date": _fmt_merge_date(today),
        "contract.end_date": _fmt_merge_date(today + timedelta(days=365)),
        "contract.notice_period_days": "30",
        "contract.value": "EUR 1.250,00 per month",
        "company.name": "Voorbeeld BV",
        "contact.name": "Jan de Vries",
        "contact.email": "jan@voorbeeld.nl",
        "tenant.name": tenant_name or "…",
        "date.today": _fmt_merge_date(today),
    }


def sample_invoice_values(tenant: "Tenant | None") -> dict[str, str]:
    today = date.today()
    subtotal = sum(i["quantity"] * i["unit_price_cents"] for i in SAMPLE_LINE_ITEMS)
    vat = sum(
        round(i["quantity"] * i["unit_price_cents"] * i["tax_rate_pct"] / 100)
        for i in SAMPLE_LINE_ITEMS
    )
    return {
        "invoice.number": "INV-0042",
        "invoice.date": _fmt_merge_date(today),
        "invoice.due_date": _fmt_merge_date(today + timedelta(days=14)),
        "invoice.subtotal": _fmt_cents_merge(subtotal),
        "invoice.vat_total": _fmt_cents_merge(vat),
        "invoice.total": _fmt_cents_merge(subtotal + vat),
        "contact.name": "Jan de Vries",
        "contact.email": "jan@voorbeeld.nl",
        "company.name": "Voorbeeld BV",
        "tenant.name": (tenant.name if tenant else None) or "…",
        "tenant.iban": (getattr(tenant, "iban", None) if tenant else None) or "NL00 BANK 0123 4567 89",
        "tenant.kvk": (getattr(tenant, "kvk_nummer", None) if tenant else None) or "12345678",
        "tenant.btw": (getattr(tenant, "btw_nummer", None) if tenant else None) or "NL000000000B00",
        "date.today": _fmt_merge_date(today),
    }
