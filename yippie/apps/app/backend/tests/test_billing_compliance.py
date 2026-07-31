"""[INV2] NL/EU invoice compliance — VAT maths, immutability, reverse charge.

DB-free (same pattern as test_templates.py): the rules under test are pure
logic, so invoices are plain namespaces rather than ORM rows.
"""
from datetime import date, datetime, timezone
from types import SimpleNamespace

import pytest

from app.modules.billing import service
from app.modules.billing.models import InvoiceStatus
from app.modules.billing.schemas import LineItem


def _invoice(**kw):
    base = dict(
        invoice_number="INV-0007",
        issued_at=None,
        reverse_charge=False,
        line_items=[],
        invoice_date=date(2026, 7, 1),
        credit_note_of_id=None,
    )
    base.update(kw)
    inv = SimpleNamespace(**base)
    # Mirrors Invoice.is_issued on the ORM model.
    inv.is_issued = inv.issued_at is not None
    return inv


def _tenant(**kw):
    base = dict(
        name="Acme BV", street_address="Kade 1", postal_code="1011 AA", city="Amsterdam",
        country="Nederland", kvk_nummer="12345678", btw_nummer="NL001234567B01",
        iban="NL00BANK0123456789", phone="0201234567",
    )
    base.update(kw)
    return SimpleNamespace(**base)


def _contact(**kw):
    base = dict(
        full_name="Jan de Vries", company_name="Klant BV", email="jan@example.nl",
        street_address="Dorpsstraat 2", postal_code="3500 BB", city="Utrecht",
        country="Nederland", btw_nummer=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


# ── VAT maths ─────────────────────────────────────────────────────────────────

def test_totals_use_per_line_vat_rates():
    items = [
        LineItem(description="Advies", quantity=2, unit_price_cents=10000, tax_rate_pct=21),
        LineItem(description="Boek", quantity=1, unit_price_cents=5000, tax_rate_pct=9),
    ]
    subtotal, tax = service._compute_totals(items)
    assert subtotal == 25000
    assert tax == 4200 + 450


def test_vat_breakdown_groups_by_rate():
    items = [
        {"description": "a", "quantity": 1, "unit_price_cents": 10000, "tax_rate_pct": 21},
        {"description": "b", "quantity": 1, "unit_price_cents": 20000, "tax_rate_pct": 21},
        {"description": "c", "quantity": 1, "unit_price_cents": 5000, "tax_rate_pct": 9},
    ]
    breakdown = {b.rate_pct: b for b in service.compute_vat_breakdown(items)}
    assert breakdown[21].subtotal_cents == 30000
    assert breakdown[21].vat_cents == 6300
    assert breakdown[9].vat_cents == 450


def test_reverse_charge_zeroes_vat_on_every_line():
    """BTW verlegd shifts the liability to the customer, so the supplier charges
    nothing even though the lines still carry a 21% rate."""
    items = [LineItem(description="Advies", quantity=1, unit_price_cents=10000, tax_rate_pct=21)]
    subtotal, tax = service._compute_totals(items, reverse_charge=True)
    assert subtotal == 10000
    assert tax == 0

    breakdown = service.compute_vat_breakdown(
        [i.model_dump() for i in items], reverse_charge=True
    )
    assert [b.rate_pct for b in breakdown] == [0]
    assert breakdown[0].vat_cents == 0


def test_line_item_rejects_non_dutch_vat_rate():
    with pytest.raises(ValueError):
        LineItem(description="x", quantity=1, unit_price_cents=100, tax_rate_pct=20)


@pytest.mark.parametrize("rate", [0, 9, 21])
def test_line_item_accepts_dutch_vat_rates(rate):
    assert LineItem(description="x", quantity=1, unit_price_cents=100, tax_rate_pct=rate).tax_rate_pct == rate


# ── Immutability ──────────────────────────────────────────────────────────────

def test_draft_is_freely_editable():
    service._assert_mutable(_invoice(), {"line_items": [], "invoice_date": date.today()})


def test_issued_invoice_rejects_content_edits():
    issued = _invoice(issued_at=datetime(2026, 7, 1, tzinfo=timezone.utc))
    with pytest.raises(service.InvoiceLockedError, match="credit note"):
        service._assert_mutable(issued, {"line_items": [{"description": "changed"}]})


def test_issued_invoice_rejects_amount_and_date_edits():
    issued = _invoice(issued_at=datetime(2026, 7, 1, tzinfo=timezone.utc))
    for field in ("total_cents", "invoice_date", "notes", "reverse_charge"):
        with pytest.raises(service.InvoiceLockedError):
            service._assert_mutable(issued, {field: "whatever"})


def test_issued_invoice_still_accepts_lifecycle_status():
    """Recording that an issued invoice was paid is not a rewrite of it."""
    issued = _invoice(issued_at=datetime(2026, 7, 1, tzinfo=timezone.utc))
    service._assert_mutable(issued, {"status": InvoiceStatus.paid})


def test_issued_invoice_cannot_be_voided_directly():
    issued = _invoice(issued_at=datetime(2026, 7, 1, tzinfo=timezone.utc))
    with pytest.raises(service.InvoiceLockedError, match="credit note"):
        service._assert_mutable(issued, {"status": InvoiceStatus.void})


# ── Required fields ───────────────────────────────────────────────────────────

def test_complete_invoice_has_nothing_missing():
    inv = _invoice(line_items=[{"description": "Advies", "quantity": 1, "unit_price_cents": 100}])
    assert service._missing_invoice_fields(inv, _tenant(), _contact()) == []


def test_missing_seller_registration_numbers_are_flagged():
    inv = _invoice(line_items=[{"description": "a", "quantity": 1, "unit_price_cents": 1}])
    missing = service._missing_invoice_fields(inv, _tenant(kvk_nummer=None, btw_nummer=None), _contact())
    assert any("KvK" in m for m in missing)
    assert any("BTW nummer afzender" in m for m in missing)


def test_missing_client_address_is_flagged():
    inv = _invoice(line_items=[{"description": "a", "quantity": 1, "unit_price_cents": 1}])
    missing = service._missing_invoice_fields(inv, _tenant(), _contact(street_address=None))
    assert any("adres klant" in m for m in missing)


def test_missing_invoice_date_and_lines_are_flagged():
    missing = service._missing_invoice_fields(_invoice(invoice_date=None), _tenant(), _contact())
    assert any("factuurdatum" in m for m in missing)
    assert any("factuurregel" in m for m in missing)


def test_reverse_charge_requires_client_vat_number():
    """The BTW verlegd statement can only be made to a VAT registered business."""
    inv = _invoice(
        reverse_charge=True,
        line_items=[{"description": "a", "quantity": 1, "unit_price_cents": 1}],
    )
    missing = service._missing_invoice_fields(inv, _tenant(), _contact(btw_nummer=None))
    assert any("BTW nummer klant" in m for m in missing)

    ok = service._missing_invoice_fields(inv, _tenant(), _contact(btw_nummer="BE0123456789"))
    assert ok == []


# ── Snapshots ─────────────────────────────────────────────────────────────────

def test_snapshots_capture_both_parties():
    seller = service._snapshot_seller(_tenant())
    client = service._snapshot_client(_contact(btw_nummer="BE0123456789"))
    assert seller["kvk_nummer"] == "12345678"
    assert seller["btw_nummer"] == "NL001234567B01"
    assert client["street_address"] == "Dorpsstraat 2"
    assert client["btw_nummer"] == "BE0123456789"


def test_party_lines_render_recipient_then_address():
    lines = service._party_lines(service._snapshot_client(_contact()), is_seller=False)
    assert lines[0] == "Jan de Vries"
    assert "Dorpsstraat 2" in lines
    assert "3500 BB Utrecht" in lines


def test_seller_lines_carry_registration_numbers():
    lines = service._party_lines(service._snapshot_seller(_tenant()), is_seller=True)
    assert "KvK: 12345678" in lines
    assert "BTW: NL001234567B01" in lines
    assert "IBAN: NL00BANK0123456789" in lines


# ── Numbering ─────────────────────────────────────────────────────────────────

def test_numeric_suffix_parses_imported_numbers():
    assert service._numeric_suffix("INV-0042") == 42
    assert service._numeric_suffix("2026/0007") == 20260007
    assert service._numeric_suffix("") is None
    assert service._numeric_suffix("CONCEPT") is None
