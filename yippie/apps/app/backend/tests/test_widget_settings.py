"""[WGT1] Website widget settings — snippet rendering, defaults, admin gating.

DB-free: snippet building is pure logic over a tenant row, so a namespace stands
in for the ORM object (same pattern as test_templates.py).
"""
from types import SimpleNamespace

import pytest

from app.modules.team import service
from app.modules.team.schemas import WidgetSettingsUpdate


def _tenant(**kw):
    base = dict(
        slug="acme", primary_color="#123456", widget_accent_color=None,
        lead_widget_enabled=True, lead_widget_button_text=None, lead_widget_heading=None,
        booking_widget_enabled=True, booking_widget_button_text=None, booking_widget_heading=None,
    )
    base.update(kw)
    return SimpleNamespace(**base)


# ── Snippets ──────────────────────────────────────────────────────────────────

def test_all_three_snippets_are_rendered_for_the_tenant():
    out = service.build_widget_settings(_tenant())
    for key, script in (
        ("chat_snippet", "widget.js"),
        ("lead_snippet", "lead-widget.js"),
        ("booking_snippet", "booking-widget.js"),
    ):
        assert script in out[key]
        assert 'data-tenant="acme"' in out[key]


def test_booking_page_url_points_at_the_hosted_meet_page():
    assert service.build_widget_settings(_tenant()).get("booking_page_url").endswith("/meet/acme")


def test_snippets_use_the_environment_base_url_not_a_hardcoded_host():
    """A snippet copied on sandbox must point at sandbox, not production."""
    from app.config import get_settings

    expected = get_settings().effective_base_url or "https://app.getyippie.com"
    assert service.build_widget_settings(_tenant())["chat_snippet"].startswith(f'<script src="{expected}/')


# ── Defaults ──────────────────────────────────────────────────────────────────

def test_accent_falls_back_to_workspace_primary_colour():
    assert service.build_widget_settings(_tenant())["accent_color"] == "#123456"


def test_explicit_widget_accent_overrides_primary_colour():
    out = service.build_widget_settings(_tenant(widget_accent_color="#ABCDEF"))
    assert out["accent_color"] == "#ABCDEF"


def test_unset_labels_fall_back_to_built_in_copy():
    out = service.build_widget_settings(_tenant())
    assert out["lead_widget_button_text"] == "Get in touch"
    assert out["booking_widget_button_text"] == "Book a meeting"
    assert out["lead_widget_heading"] == "Contact us"
    assert out["booking_widget_heading"] == "Pick a time"


def test_custom_labels_are_returned_as_set():
    out = service.build_widget_settings(
        _tenant(lead_widget_button_text="Vraag offerte aan", booking_widget_heading="Kies een moment")
    )
    assert out["lead_widget_button_text"] == "Vraag offerte aan"
    assert out["booking_widget_heading"] == "Kies een moment"


def test_disabled_flags_are_reported():
    out = service.build_widget_settings(_tenant(lead_widget_enabled=False, booking_widget_enabled=False))
    assert out["lead_widget_enabled"] is False
    assert out["booking_widget_enabled"] is False


# ── Validation ────────────────────────────────────────────────────────────────

@pytest.mark.parametrize("colour", ["#fff", "#5BA4F5", "#abcdef"])
def test_valid_hex_accents_are_accepted(colour):
    assert WidgetSettingsUpdate(accent_color=colour).accent_color == colour


def test_button_text_is_length_capped():
    with pytest.raises(ValueError):
        WidgetSettingsUpdate(lead_widget_button_text="x" * 61)


class _StubDB:
    """Minimal async stand in — update_widget_settings only needs get/commit/refresh."""

    def __init__(self, tenant):
        self._tenant = tenant

    async def get(self, _model, _id):
        return self._tenant

    async def commit(self):
        pass

    async def refresh(self, _obj):
        pass


@pytest.mark.asyncio
@pytest.mark.parametrize("bad", ["red", "5BA4F5", "#12345", "#GGGGGG", "rgb(1,2,3)"])
async def test_non_hex_accent_is_rejected(bad):
    """A junk colour would render an unstyled button on every embedding site."""
    with pytest.raises(ValueError, match="hex"):
        await service.update_widget_settings(
            _StubDB(_tenant()), "tid", WidgetSettingsUpdate(accent_color=bad)
        )


@pytest.mark.asyncio
async def test_blank_label_resets_to_default_rather_than_empty_button():
    tenant = _tenant(lead_widget_button_text="Old")
    await service.update_widget_settings(
        _StubDB(tenant), "tid", WidgetSettingsUpdate(lead_widget_button_text="   ")
    )
    assert tenant.lead_widget_button_text is None
    assert service.build_widget_settings(tenant)["lead_widget_button_text"] == "Get in touch"


@pytest.mark.asyncio
async def test_blank_accent_clears_back_to_workspace_colour():
    tenant = _tenant(widget_accent_color="#ABCDEF")
    await service.update_widget_settings(
        _StubDB(tenant), "tid", WidgetSettingsUpdate(accent_color="")
    )
    assert tenant.widget_accent_color is None
    assert service.build_widget_settings(tenant)["accent_color"] == "#123456"


def test_partial_update_only_carries_provided_fields():
    """model_dump(exclude_unset) drives the patch, so an untouched field is
    never overwritten with a default."""
    changes = WidgetSettingsUpdate(lead_widget_button_text="Bel ons").model_dump(exclude_unset=True)
    assert changes == {"lead_widget_button_text": "Bel ons"}
