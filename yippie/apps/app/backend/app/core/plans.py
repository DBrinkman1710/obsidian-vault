"""Tenant SaaS plan tiers and the plan -> feature map (single source of truth).

This is the *tenant's own* subscription to Yippie — distinct from the billing
module's ``Subscription.plan_name``, which models a customer's subscription that
a tenant invoices. The two never mix: this file gates which Yippie features a
tenant may use; billing tracks what that tenant charges its own customers.

Gating layers ON TOP of the existing module system (``Tenant.enabled_modules``
+ ``require_module``). A feature is usable only when it is BOTH enabled for the
tenant AND included in the tenant's plan. See ``app.auth.dependencies``.
"""
from __future__ import annotations

import enum


class PlanTier(str, enum.Enum):
    founder = "founder"
    starter = "starter"
    growth = "growth"
    pro = "pro"          # legacy — existing tenants keep this value
    enterprise = "enterprise"


DEFAULT_PLAN = PlanTier.enterprise


# Core features available on every tier (including free). These are the
# headcount-reduction core of the product, so they are never plan-gated.
# Tickets and Billing are now paid add-ons, not included in the base plan.
CORE_FEATURES: set[str] = {
    "inbox",
    "contacts",
    "activity",
}

# Advanced features, unlocked progressively by tier. Names match module keys in
# ``app.modules.MODULES`` so a feature gate can sit alongside ``require_module``.
ADVANCED_FEATURES: set[str] = {
    "chat",
    "calendar",
    "pipeline",
    "ai",
    "tickets",
    "billing",
    "marketing",
    "departments",
}

ALL_FEATURES: set[str] = CORE_FEATURES | ADVANCED_FEATURES


# Plan -> the full set of features that plan unlocks. Modules are à la carte
# add-ons gated by the per-tenant module toggles, so every plan unlocks every
# feature here — the plan governs user/contact limits (see PLAN_LIMITS), not
# which modules are reachable. Kept as a dict so feature-level gating remains
# available should pricing change.
PLAN_FEATURES: dict[PlanTier, set[str]] = {
    PlanTier.founder: set(ALL_FEATURES),
    PlanTier.starter: set(ALL_FEATURES),
    PlanTier.growth: set(ALL_FEATURES),
    PlanTier.pro: set(ALL_FEATURES),
    PlanTier.enterprise: set(ALL_FEATURES),
}


# Per-plan seat caps and pricing (euros). ``None`` means unlimited.
# All plans have unlimited contacts. Plans differ by users and AI scans/month.
# price_annual = monthly * 12 * 0.9 (10% discount, billed as a single yearly charge)
# ``module_discount`` is the fraction off à la carte paid add-on modules
# (MODULE_PRICES) this plan grants — e.g. 0.5 == 50% off. The Founder plan is a
# limited launch offer: 10 seats plus 50% off every paid add-on module.
PLAN_LIMITS: dict[PlanTier, dict[str, "int | float | None"]] = {
    PlanTier.founder:    {"users": 10,   "contacts": None, "ai_scans": 500,    "price_monthly": 9,    "price_annual": 97,   "module_discount": 0.5},
    PlanTier.starter:    {"users": 3,    "contacts": None, "ai_scans": 2_000,  "price_monthly": 19,   "price_annual": 205,  "module_discount": 0.0},
    PlanTier.growth:     {"users": 5,    "contacts": None, "ai_scans": 5_000,  "price_monthly": 39,   "price_annual": 421,  "module_discount": 0.0},
    PlanTier.pro:        {"users": 10,   "contacts": None, "ai_scans": 10_000, "price_monthly": 69,   "price_annual": 745,  "module_discount": 0.0},
    PlanTier.enterprise: {"users": None, "contacts": None, "ai_scans": None,   "price_monthly": None, "price_annual": None, "module_discount": 0.0},
}


# À la carte module add-on prices (euros per month). Keyed by the module name
# in ``app.modules.MODULES``. Core modules (inbox/contacts/activity) are always
# included; everything else is a paid add-on.
MODULE_PRICES: dict[str, int] = {
    "tickets": 9,
    "ai": 15,
    "calendar": 7,
    "kanban": 7,
    "chat": 9,
    "marketing": 9,
    "departments": 7,
    "billing": 7,
    "sales": 20,
    "saas": 20,
    "tracking": 9,
    "activity": 9,
}


def _coerce_plan(plan: "PlanTier | str | None") -> PlanTier:
    """Best-effort coercion to a PlanTier; unknown/empty values fall back to founder."""
    if isinstance(plan, PlanTier):
        return plan
    if not plan:
        return PlanTier.founder
    try:
        return PlanTier(str(plan))
    except ValueError:
        return PlanTier.founder


def limits_for_plan(plan: "PlanTier | str | None") -> dict[str, "int | float | None"]:
    """The seat/contact caps + module discount a plan permits (``None`` == unlimited)."""
    return dict(PLAN_LIMITS.get(_coerce_plan(plan), PLAN_LIMITS[PlanTier.founder]))


def module_discount_for_plan(plan: "PlanTier | str | None") -> float:
    """Fraction off paid add-on modules this plan grants (0.0–1.0)."""
    limits = PLAN_LIMITS.get(_coerce_plan(plan), PLAN_LIMITS[PlanTier.founder])
    return float(limits.get("module_discount") or 0.0)


def module_prices_for_plan(plan: "PlanTier | str | None") -> dict[str, int]:
    """À la carte module prices after this plan's add-on discount is applied."""
    discount = module_discount_for_plan(plan)
    if discount <= 0:
        return dict(MODULE_PRICES)
    return {name: round(price * (1 - discount)) for name, price in MODULE_PRICES.items()}


def features_for_plan(plan: "PlanTier | str | None") -> set[str]:
    """The feature set a plan unlocks (core features always included)."""
    return set(PLAN_FEATURES.get(_coerce_plan(plan), CORE_FEATURES))


def plan_allows(plan: "PlanTier | str | None", feature: str) -> bool:
    """True if ``feature`` is unlocked by ``plan``.

    Core features are always allowed regardless of plan, so a misconfigured plan
    can never knock out the inbox/tickets/contacts the business runs on.
    """
    if feature in CORE_FEATURES:
        return True
    return feature in features_for_plan(plan)
