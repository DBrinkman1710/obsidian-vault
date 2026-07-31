"""[TMPL1] block based document templates — schema, merge fields, PDF renderer.

DB-free (same pattern as test_flows.py): validation and rendering are pure
logic; the fpdf2 smoke tests use plain namespaces instead of ORM rows.
"""
from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

from app.core.doc_blocks import (
    CONTRACT_MERGE_FIELDS,
    INVOICE_MERGE_FIELDS,
    SAMPLE_LINE_ITEMS,
    BlockDocument,
    body_text_to_blocks,
    flatten_blocks_to_text,
    invoice_merge_values,
    render_text_merge_fields,
    resolve_merge_fields_in_blocks,
    sample_contract_values,
    sample_invoice_values,
    validate_blocks,
)
from app.core.doc_blocks_pdf import RenderContext, SignatureData, render_blocks_pdf


def _doc(*blocks):
    return {"version": 1, "blocks": list(blocks)}


def _block(type_, config=None, id_="b_test0001"):
    return {"id": id_, "type": type_, "config": config or {}}


# ------------------------------------------------------------ validate_blocks

def test_shared_blocks_valid_for_both_doc_types():
    raw = _doc(
        _block("heading", {"text": "Titel"}, "b_1"),
        _block("text", {"text": "Hallo"}, "b_2"),
        _block("divider", {}, "b_3"),
        _block("notes", {}, "b_4"),
        _block("footer", {"text": "Gegenereerd met Yippie"}, "b_5"),
        _block("logo_header", {}, "b_6"),
    )
    assert len(validate_blocks(raw, "contract").blocks) == 6
    assert len(validate_blocks(raw, "invoice").blocks) == 6


def test_signature_rejected_for_invoices():
    with pytest.raises(ValueError, match="signature"):
        validate_blocks(_doc(_block("signature")), "invoice")


def test_invoice_blocks_rejected_for_contracts():
    for type_ in ("line_items", "totals"):
        with pytest.raises(ValueError, match=type_):
            validate_blocks(_doc(_block(type_)), "contract")


def test_unknown_block_type_rejected():
    with pytest.raises(ValueError):
        validate_blocks(_doc(_block("marquee")), "contract")


def test_unknown_doc_type_rejected():
    with pytest.raises(ValueError):
        validate_blocks(_doc(), "quote")


def test_config_coerced_and_unknown_keys_dropped():
    raw = _doc(_block("text", {"text": "x", "size": "sm", "hacker": "field"}))
    doc = validate_blocks(raw, "contract")
    assert doc.blocks[0].config == {"text": "x", "size": "sm", "align": "left"}


def test_invalid_config_value_rejected():
    with pytest.raises(ValueError, match="heading"):
        validate_blocks(_doc(_block("heading", {"level": 9})), "contract")


def test_duplicate_and_malformed_ids_regenerated():
    raw = _doc(
        _block("text", {"text": "a"}, "b_1"),
        _block("text", {"text": "b"}, "b_1"),
        _block("text", {"text": "c"}, "<script>"),
    )
    doc = validate_blocks(raw, "contract")
    ids = [b.id for b in doc.blocks]
    assert len(set(ids)) == 3
    assert all(len(i) <= 40 for i in ids)


def test_too_many_blocks_rejected():
    raw = _doc(*[_block("text", {"text": "x"}, f"b_{i}") for i in range(61)])
    with pytest.raises(ValueError, match="Too many"):
        validate_blocks(raw, "contract")


# --------------------------------------------------------------- merge fields

def test_unknown_merge_field_renders_ellipsis():
    assert render_text_merge_fields("Hi {{contact.name}} {{contract.typo}}", {"contact.name": "Jan"}) == "Hi Jan …"


def test_resolve_merge_fields_deep_copies():
    doc = validate_blocks(_doc(_block("text", {"text": "Dag {{contact.name}}"})), "contract")
    resolved = resolve_merge_fields_in_blocks(doc, {"contact.name": "Jan"})
    assert resolved.blocks[0].config["text"] == "Dag Jan"
    assert doc.blocks[0].config["text"] == "Dag {{contact.name}}"  # original untouched


def test_invoice_merge_values_dutch_formatting():
    invoice = SimpleNamespace(
        invoice_number="INV-0007",
        invoice_date=date(2026, 7, 16),
        due_date=date(2026, 7, 30),
        subtotal_cents=123456,
        tax_cents=25926,
        total_cents=149382,
        currency="EUR",
        created_at=None,
    )
    tenant = SimpleNamespace(name="Acme BV", iban="NL01", kvk_nummer="123", btw_nummer="NL1B01")
    contact = SimpleNamespace(full_name="Jan de Vries", email="jan@acme.nl", company_name=None)
    values = invoice_merge_values(invoice, tenant, contact)
    assert values["invoice.number"] == "INV-0007"
    assert values["invoice.date"] == "16-07-2026"
    assert values["invoice.subtotal"] == "EUR 1.234,56"
    assert values["invoice.total"] == "EUR 1.493,82"
    assert values["company.name"] == "…"
    assert set(values) == set(INVOICE_MERGE_FIELDS)


def test_sample_values_cover_registries():
    assert set(sample_contract_values("Acme")) == set(CONTRACT_MERGE_FIELDS)
    assert set(sample_invoice_values(None)) == set(INVOICE_MERGE_FIELDS)


# --------------------------------------------------- flatten / migration shape

def test_body_text_to_blocks_round_trip():
    body = "Artikel 1\n\nDe partijen komen overeen."
    doc = BlockDocument.model_validate(body_text_to_blocks(body))
    assert flatten_blocks_to_text(doc) == body


def test_flatten_includes_headings_and_custom_notes_only():
    doc = validate_blocks(
        _doc(
            _block("heading", {"text": "Overeenkomst"}, "b_1"),
            _block("text", {"text": "Inhoud"}, "b_2"),
            _block("notes", {"label": "Info", "source": "custom", "text": "Vast"}, "b_3"),
            _block("notes", {"source": "document"}, "b_4"),  # document notes: not in flatten
            _block("divider", {}, "b_5"),
        ),
        "contract",
    )
    assert flatten_blocks_to_text(doc) == "Overeenkomst\n\nInhoud\n\nInfo\nVast"


# ----------------------------------------------------------------- PDF smoke

_TENANT = SimpleNamespace(
    name="Acme BV", street_address="Dorpsstraat 1", postal_code="1234 AB", city="Utrecht",
    country="Nederland", phone="+31 6 12345678", kvk_nummer="12345678",
    btw_nummer="NL000000000B00", iban="NL00 BANK 0123 4567 89", primary_color="#5BA4F5",
)


def _invoice_ctx(**overrides):
    base = dict(
        doc_type="invoice",
        tenant=_TENANT,
        tenant_name="Acme BV",
        primary_color="#5BA4F5",
        line_items=SAMPLE_LINE_ITEMS,
        meta_lines=[("Factuurnummer", "INV-0042"), ("Factuurdatum", "16-07-2026"), ("Vervaldatum", "30-07-2026")],
        notes="Betaal binnen 14 dagen.",
    )
    base.update(overrides)
    return RenderContext(**base)


def test_full_invoice_template_renders_pdf():
    doc = validate_blocks(
        _doc(
            _block("logo_header", {"title": "FACTUUR"}, "b_1"),
            _block("heading", {"text": "Factuur INV-0042", "level": 2}, "b_2"),
            _block("line_items", {}, "b_3"),
            _block("totals", {}, "b_4"),
            _block("notes", {"label": "BETALINGSINFORMATIE"}, "b_5"),
            _block("footer", {"text": "Gegenereerd met Yippie"}, "b_6"),
        ),
        "invoice",
    )
    data = render_blocks_pdf(doc, _invoice_ctx())
    assert data.startswith(b"%PDF")
    assert len(data) > 800


def test_signed_contract_audit_block_always_prints():
    # Frozen layout WITHOUT a signature block — the audit trail must still render.
    doc = validate_blocks(_doc(_block("text", {"text": "Overeenkomst"})), "contract")
    signature = SignatureData(
        signed_at=datetime(2026, 7, 16, 12, 0, tzinfo=timezone.utc),
        signer_name="Jan de Vries",
        signer_ip="203.0.113.7",
        signature_image=None,
    )
    ctx = RenderContext(doc_type="contract", tenant=_TENANT, tenant_name="Acme BV", signature=signature)
    data = render_blocks_pdf(doc, ctx)
    assert data.startswith(b"%PDF")
    # Same doc unsigned renders smaller (no audit block appended).
    unsigned = render_blocks_pdf(
        doc, RenderContext(doc_type="contract", tenant=_TENANT, tenant_name="Acme BV")
    )
    assert len(data) > len(unsigned)


def test_non_latin1_text_does_not_crash():
    doc = validate_blocks(
        _doc(_block("heading", {"text": "Übereinkunft — €500 — 契約"}), _block("text", {"text": "Русский текст"}, "b_2")),
        "contract",
    )
    data = render_blocks_pdf(doc, RenderContext(doc_type="contract", tenant=None, tenant_name="Acmé"))
    assert data.startswith(b"%PDF")


def test_unknown_block_type_skipped_by_renderer():
    # Forward compatibility: a future block type in stored JSON must not crash old code.
    doc = BlockDocument.model_validate(
        _doc(_block("text", {"text": "ok"}, "b_1"), _block("hologram", {"x": 1}, "b_2"))
    )
    data = render_blocks_pdf(doc, RenderContext(doc_type="contract", tenant=None, tenant_name=""))
    assert data.startswith(b"%PDF")


def test_line_items_without_vat_column():
    doc = validate_blocks(
        _doc(_block("line_items", {"show_vat_column": False, "zebra": False}), _block("totals", {"show_vat_breakdown": False}, "b_2")),
        "invoice",
    )
    data = render_blocks_pdf(doc, _invoice_ctx())
    assert data.startswith(b"%PDF")


# ── [INV2] Recipient block + reverse charge in the shared invoice renderer ────
# The recipient block has no block type of its own: the renderer draws it with
# the header so every invoice carries the legally required client details. These
# guard the builder preview against drifting from what really gets sent.


def _pdf_text(pdf: bytes) -> str:
    """Extract drawn text from an fpdf2 PDF (content streams are compressed)."""
    import re
    import zlib

    chunks = []
    for m in re.finditer(rb"stream\r?\n(.*?)endstream", pdf, re.S):
        raw = m.group(1)
        try:
            raw = zlib.decompress(raw)
        except Exception:
            pass
        chunks.append(raw.decode("latin-1", "ignore"))
    return "".join(re.findall(r"\((.*?)\)\s*Tj", "".join(chunks)))


def _header_doc():
    return validate_blocks(
        _doc(
            _block("logo_header", {"title": "FACTUUR"}, "b_1"),
            _block("line_items", {"show_vat_column": True}, "b_2"),
            _block("totals", {"show_vat_breakdown": True}, "b_3"),
        ),
        "invoice",
    )


def test_invoice_renders_the_recipient_block_when_client_lines_given():
    ctx = _invoice_ctx()
    ctx.client_lines = ["Jan de Vries", "Dorpsstraat 2", "3500 BB Utrecht"]
    text = _pdf_text(render_blocks_pdf(_header_doc(), ctx))
    assert "FACTUUR AAN" in text
    assert "Jan de Vries" in text
    assert "Dorpsstraat 2" in text


def test_invoice_without_client_lines_omits_the_recipient_block():
    """Guards the preview fix: a context with no client must not silently print
    an empty FACTUUR AAN heading."""
    assert "FACTUUR AAN" not in _pdf_text(render_blocks_pdf(_header_doc(), _invoice_ctx()))


def test_reverse_charge_prints_verlegd_not_vrijgesteld():
    ctx = _invoice_ctx()
    ctx.reverse_charge = True
    ctx.reverse_charge_statement = "BTW verlegd naar BTW nummer BE0123456789"
    text = _pdf_text(render_blocks_pdf(_header_doc(), ctx))
    assert "BTW verlegd" in text
    assert "BE0123456789" in text
    # Exempt and reverse charged are different legal statements.
    assert "BTW vrijgesteld" not in text


def test_reverse_charge_zeroes_the_vat_column():
    ctx = _invoice_ctx()
    ctx.reverse_charge = True
    text = _pdf_text(render_blocks_pdf(_header_doc(), ctx))
    assert "21%" not in text
