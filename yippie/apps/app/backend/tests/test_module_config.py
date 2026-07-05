"""Invariants for the generated module/pricing config (_modules_gen).

The canonical source is packages/config/modules.json; `pnpm sync:config`
regenerates ``app/core/_modules_gen.py`` (and the TS copies). This suite guards
against a hand-edited or internally inconsistent generated file. Cross-file
parity (json ↔ every generated target) is enforced separately by
`pnpm check:config`, which can read packages/ (not in the backend image).

These are DB-free and run in the Docker build's pytest gate.
"""
from __future__ import annotations

from app.core import _modules_gen as gen
from app.core.plans import MODULE_PRICES as PLANS_MODULE_PRICES, PLAN_LIMITS, PlanTier
from app.config import ALL_MODULES as CONFIG_ALL_MODULES


def test_all_modules_unique_and_wired():
    assert len(gen.ALL_MODULES) == len(set(gen.ALL_MODULES)), "duplicate module id"
    assert gen.ALL_MODULES == CONFIG_ALL_MODULES, "config.ALL_MODULES must be the generated list"
    assert set(gen.CORE_MODULES) <= set(gen.ALL_MODULES)


def test_prices_are_paid_non_core():
    for mod, price in gen.MODULE_PRICES.items():
        assert mod in gen.ALL_MODULES, f"priced module {mod!r} not in ALL_MODULES"
        assert mod not in gen.CORE_MODULES, f"core module {mod!r} must not be priced"
        assert isinstance(price, int) and price > 0, f"{mod!r} has invalid price {price!r}"
    # plans.py must expose exactly the generated prices.
    assert PLANS_MODULE_PRICES == gen.MODULE_PRICES


def test_stripe_keys_match_paid_modules():
    # Every lookup key is yippie_module_<id> and maps to a paid module id.
    for lookup_key, mod in gen.MODULE_STRIPE_KEYS.items():
        assert lookup_key == f"yippie_module_{mod}"
        assert mod in gen.MODULE_PRICES, f"stripe key for non-paid module {mod!r}"
    assert set(gen.MODULE_STRIPE_KEYS.values()) == set(gen.MODULE_PRICES.keys())


def test_meta_covers_every_module():
    assert set(gen.MODULE_META.keys()) == set(gen.ALL_MODULES)


def test_plan_limits_coerce_to_plantier():
    for name in gen.PLAN_LIMITS:
        PlanTier(name)  # raises if a plan name is not a valid tier
    assert set(PLAN_LIMITS.keys()) == {PlanTier(n) for n in gen.PLAN_LIMITS}


def test_pipeline_billing_regression():
    # Guards the historical kanban↔pipeline drift that left Pipeline unbillable.
    assert gen.MODULE_PRICES.get("pipeline") == 7
    assert "kanban" not in gen.MODULE_PRICES
    assert "yippie_module_pipeline" in gen.MODULE_STRIPE_KEYS
    # activity is core and must never carry a price.
    assert "activity" not in gen.MODULE_PRICES
