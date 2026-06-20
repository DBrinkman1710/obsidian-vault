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
CORE_FEATURES: set[str] = {
    "inbox",
    "tickets",
    "contacts",
    "activity",
    "billing",
}

# Advanced features, unlocked progressively by tier. Names match module keys in
# ``app.modules.MODULES`` so a feature gate can sit alongside ``require_module``.
ADVANCED_FEATURES: set[str] = {
    "chat",
    "calendar",
    "pipeline",
    "emailtracking",
    "ai",
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
PLAN_LIMITS: dict[PlanTier, dict[str, "int | None"]] = {
    PlanTier.founder:    {"users": 2,    "contacts": None, "ai_scans": 500,    "price_monthly": 9,    "price_annual": 97},
    PlanTier.starter:    {"users": 5,    "contacts": None, "ai_scans": 2_000,  "price_monthly": 19,   "price_annual": 205},
    PlanTier.growth:     {"users": 10,   "contacts": None, "ai_scans": 10_000, "price_monthly": 49,   "price_annual": 529},
    PlanTier.pro:        {"users": None, "contacts": None, "ai_scans": None,   "price_monthly": None, "price_annual": None},
    PlanTier.enterprise: {"users": None, "contacts": None, "ai_scans": None,   "price_monthly": None, "price_annual": None},
}


# À la carte module add-on prices (placeholder, euros per month). Keyed by the
# module name in ``app.modules.MODULES``.
MODULE_PRICES: dict[str, int] = {
    "tickets": 15,
    "ai": 19,
    "calendar": 12,
    "kanban": 12,
    "emailtracking": 9,
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


def limits_for_plan(plan: "PlanTier | str | None") -> dict[str, "int | None"]:
    """The seat/contact caps a plan permits (``None`` == unlimited)."""
    return dict(PLAN_LIMITS.get(_coerce_plan(plan), PLAN_LIMITS[PlanTier.founder]))


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
