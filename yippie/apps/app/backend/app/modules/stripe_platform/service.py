from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone

import stripe as _stripe
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.models import Tenant
from app.core.plans import PlanTier

log = logging.getLogger(__name__)

# Maps Stripe price lookup_keys → Yippie plan tier.
PLAN_LOOKUP_KEYS: dict[str, PlanTier] = {
    "yippie_founder_monthly": PlanTier.founder,
    "yippie_founder_annual": PlanTier.founder,
    "yippie_starter_monthly": PlanTier.starter,
    "yippie_starter_annual": PlanTier.starter,
    "yippie_growth_monthly": PlanTier.growth,
    "yippie_growth_annual":  PlanTier.growth,
    "yippie_pro_monthly":    PlanTier.pro,
    "yippie_pro_annual":     PlanTier.pro,
}

# Maps Stripe price lookup_keys → Yippie module id. Canonical source:
# packages/config/modules.json via ``_modules_gen`` (`pnpm sync:config`).
from app.core._modules_gen import MODULE_STRIPE_KEYS as MODULE_LOOKUP_KEYS  # noqa: F401

# Core modules always included regardless of add-on subscriptions.
CORE_MODULES = ["inbox", "contacts", "activity"]

# Stripe coupon (provisioned by ~/Claude Code/create_stripe_catalog.py) that
# gives the Founder launch plan its 50% off add-on modules. It is scoped to the
# module products only (applies_to.products), so attaching it to a subscription
# never discounts the base plan — only the module line items. Mirrors
# module_discount on PlanTier.founder in app/core/plans.py.
FOUNDER_MODULE_COUPON = "yippie_founder_modules_50"


def _module_lookup_key(module_id: str) -> str:
    return f"yippie_module_{module_id}"


def _paid_modules(modules: list[str]) -> list[str]:
    """Add-on (billable) modules — everything that isn't a free core module and
    has a Stripe price lookup_key defined."""
    valid = set(MODULE_LOOKUP_KEYS.values())
    return [m for m in modules if m not in CORE_MODULES and m in valid]


def _stripe_configured() -> bool:
    return bool(get_settings().stripe_secret_key)


async def sync_subscription_to_tenant(
    db: AsyncSession,
    tenant: Tenant,
    subscription: _stripe.Subscription,
) -> None:
    """Map a Stripe Subscription object back to Tenant.plan + enabled_modules.
    Called from webhook events so we never drift out of sync with Stripe."""
    new_plan: PlanTier | None = None
    paid_modules: list[str] = []
    price_ids: list[str] = []

    for item in subscription.get("items", {}).get("data", []):
        price = item.get("price", {})
        lookup_key = price.get("lookup_key") or ""
        price_id = price.get("id") or ""
        if price_id:
            price_ids.append(price_id)
        if lookup_key in PLAN_LOOKUP_KEYS:
            new_plan = PLAN_LOOKUP_KEYS[lookup_key]
        elif lookup_key in MODULE_LOOKUP_KEYS:
            paid_modules.append(MODULE_LOOKUP_KEYS[lookup_key])

    new_status = subscription.get("status", "")
    updates: dict = {
        "stripe_subscription_id": subscription.get("id"),
        "stripe_subscription_status": new_status,
        "stripe_price_ids": price_ids,
    }

    if new_plan is not None:
        updates["plan"] = new_plan.value

    if paid_modules:
        current_modules = tenant.enabled_modules or list(CORE_MODULES)
        merged = list(dict.fromkeys(CORE_MODULES + current_modules + paid_modules))
        updates["enabled_modules"] = merged

    # [TRIAL30] An active (or trialing-in-Stripe) subscription converts a trial
    # tenant — clear the trial deadline so trial_expiry_check leaves it alone.
    if new_status in ("active", "trialing") and tenant.trial_ends_at is not None:
        updates["trial_ends_at"] = None

    # A live subscription unlocks the workspace — clear any access lock set by the
    # trial/subscription expiry jobs so the subscribe modal drops away. Also clear
    # subscription_ends_at: it is only ever set on cancellation and never cleared
    # elsewhere, so leaving a past value here would make the hourly
    # subscription_expiry_check re-lock this now-paying tenant within the hour.
    if new_status in ("active", "trialing"):
        updates["access_locked_at"] = None
        updates["subscription_ends_at"] = None

    await db.execute(update(Tenant).where(Tenant.id == tenant.id).values(**updates))
    await db.commit()
    log.info("Synced Stripe subscription %s to tenant %s (plan=%s status=%s)", subscription.get("id"), tenant.slug, new_plan, new_status)


async def create_checkout_session(
    tenant: Tenant,
    plan: str,
    interval: str,
    module_add_ons: list[str],
    success_url: str,
    cancel_url: str,
) -> str:
    """Create a Stripe Checkout Session and return the URL."""
    import stripe
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key

    plan_lookup_key = f"yippie_{plan}_{interval}"
    module_lookup_keys = [f"yippie_module_{m}" for m in module_add_ons if m in MODULE_LOOKUP_KEYS.values()]

    all_lookup_keys = [plan_lookup_key] + module_lookup_keys
    # The Stripe SDK is synchronous — each call is a network round-trip that
    # would otherwise stall the event loop for hundreds of ms.
    prices_response = await asyncio.to_thread(
        stripe.Price.list, lookup_keys=all_lookup_keys, expand=["data.product"]
    )
    found_prices = {p["lookup_key"]: p["id"] for p in prices_response["data"] if p.get("lookup_key")}

    if plan_lookup_key not in found_prices:
        raise ValueError(f"Stripe price not found for lookup_key '{plan_lookup_key}'. Create the product in the Stripe dashboard first.")

    line_items = [{"price": found_prices[plan_lookup_key], "quantity": 1}]
    for lk in module_lookup_keys:
        if lk in found_prices:
            line_items.append({"price": found_prices[lk], "quantity": 1})

    params: dict = {
        "mode": "subscription",
        "line_items": line_items,
        "success_url": success_url,
        "cancel_url": cancel_url,
        "metadata": {"tenant_id": str(tenant.id), "tenant_slug": tenant.slug},
        "subscription_data": {"metadata": {"tenant_id": str(tenant.id), "tenant_slug": tenant.slug}},
    }

    # Founder plan perk: 50% off add-on modules, applied via a product-scoped
    # coupon so only the module line items are discounted, never the base plan.
    if plan == PlanTier.founder.value:
        params["discounts"] = [{"coupon": FOUNDER_MODULE_COUPON}]

    # In subscription mode Stripe always creates a Customer automatically, so we
    # only ever pass an existing one. (customer_creation is payment-mode only —
    # passing it here 500s every first-time checkout with InvalidRequestError.)
    if tenant.stripe_customer_id:
        params["customer"] = tenant.stripe_customer_id

    session = await asyncio.to_thread(stripe.checkout.Session.create, **params)
    return session["url"]


async def sync_tenant_modules_to_stripe(
    tenant: Tenant, added: list[str], removed: list[str]
) -> None:
    """Add/remove Stripe subscription items so a tenant's live subscription bills
    exactly the paid modules it has enabled.

    Best effort: a tenant without a live subscription (still on trial, or never
    subscribed) has nothing to sync — the modules will be billed at their next
    checkout instead. Founder discounting is automatic: the founder coupon is
    subscription scoped to module products, so any module item added here is
    discounted without extra work. Never raises — a Stripe hiccup must not block
    the tenant edit that triggered it; the webhook re-sync is the backstop.
    """
    if not _stripe_configured():
        return
    if not tenant.stripe_subscription_id:
        return
    if tenant.stripe_subscription_status not in ("active", "trialing", "past_due"):
        return

    add = _paid_modules(added)
    drop = _paid_modules(removed)
    if not add and not drop:
        return

    import stripe
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key

    try:
        sub = await asyncio.to_thread(
            stripe.Subscription.retrieve,
            tenant.stripe_subscription_id,
            expand=["items.data.price"],
        )
        by_lookup: dict[str, str] = {}
        for it in sub.get("items", {}).get("data", []):
            lk = (it.get("price") or {}).get("lookup_key")
            if lk:
                by_lookup[lk] = it["id"]

        for module_id in add:
            lk = _module_lookup_key(module_id)
            if lk in by_lookup:
                continue  # already billed
            prices = await asyncio.to_thread(
                stripe.Price.list, lookup_keys=[lk], active=True, limit=1
            )
            if not prices["data"]:
                log.warning("No Stripe price for module '%s' (%s) — not billed", module_id, lk)
                continue
            await asyncio.to_thread(
                stripe.SubscriptionItem.create,
                subscription=tenant.stripe_subscription_id,
                price=prices["data"][0]["id"],
                quantity=1,
            )
            log.info("Added Stripe subscription item for module '%s' on tenant %s", module_id, tenant.slug)

        for module_id in drop:
            item_id = by_lookup.get(_module_lookup_key(module_id))
            if item_id:
                await asyncio.to_thread(stripe.SubscriptionItem.delete, item_id)
                log.info("Removed Stripe subscription item for module '%s' on tenant %s", module_id, tenant.slug)
    except Exception:
        log.exception("Failed to sync modules to Stripe for tenant %s", tenant.slug)


async def create_portal_session(tenant: Tenant, return_url: str) -> str:
    """Create a Stripe Customer Portal session and return the URL."""
    import stripe
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key

    if not tenant.stripe_customer_id:
        raise ValueError("No Stripe customer linked to this tenant yet.")

    session = await asyncio.to_thread(
        stripe.billing_portal.Session.create,
        customer=tenant.stripe_customer_id,
        return_url=return_url,
    )
    return session["url"]


async def report_ai_scan_usage(db: AsyncSession) -> None:
    """Nightly job: report accumulated AI scan counts to Stripe Billing Meter,
    then reset the counters. Only runs when Stripe is configured."""
    if not _stripe_configured():
        return

    import stripe
    settings = get_settings()
    stripe.api_key = settings.stripe_secret_key

    result = await db.execute(
        select(Tenant).where(
            Tenant.stripe_customer_id.is_not(None),
            Tenant.ai_scans_used_this_period > 0,
        )
    )
    tenants = result.scalars().all()

    for tenant in tenants:
        try:
            await asyncio.to_thread(
                stripe.billing.MeterEvent.create,
                event_name="ai_scan_usage",
                payload={
                    "value": str(tenant.ai_scans_used_this_period),
                    "stripe_customer_id": tenant.stripe_customer_id,
                },
                identifier=f"{tenant.id}-{datetime.now(timezone.utc).strftime('%Y%m%d')}",
            )
            await db.execute(
                update(Tenant)
                .where(Tenant.id == tenant.id)
                .values(ai_scans_used_this_period=0, ai_scans_period_start=datetime.now(timezone.utc))
            )
        except Exception:
            log.exception("Failed to report AI scan usage for tenant %s", tenant.slug)

    await db.commit()
