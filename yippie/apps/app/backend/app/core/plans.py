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
    free = "free"
    starter = "starter"
    pro = "pro"
    enterprise = "enterprise"


# The tier assigned to existing tenants by the migration. Enterprise unlocks
# every feature, so introducing plan gating never locks anyone out of something
# they can use today — superadmins can later downgrade individual tenants.
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


# Plan -> the full set of features that plan unlocks. Higher tiers are supersets
# of lower ones. Every tier includes CORE_FEATURES.
PLAN_FEATURES: dict[PlanTier, set[str]] = {
    PlanTier.free: set(CORE_FEATURES),
    PlanTier.starter: CORE_FEATURES | {"chat"},
    PlanTier.pro: CORE_FEATURES | {"chat", "calendar", "pipeline", "emailtracking"},
    PlanTier.enterprise: set(ALL_FEATURES),
}


def _coerce_plan(plan: "PlanTier | str | None") -> PlanTier:
    """Best-effort coercion to a PlanTier; unknown/empty values fall back to free."""
    if isinstance(plan, PlanTier):
        return plan
    if not plan:
        return PlanTier.free
    try:
        return PlanTier(str(plan))
    except ValueError:
        return PlanTier.free


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
