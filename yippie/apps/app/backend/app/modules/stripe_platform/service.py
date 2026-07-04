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

# Maps Stripe price lookup_keys → Yippie module name.
MODULE_LOOKUP_KEYS: dict[str, str] = {
    "yippie_module_tickets": "tickets",
    "yippie_module_ai": "ai",
    "yippie_module_calendar": "calendar",
    "yippie_module_kanban": "kanban",
    "yippie_module_chat": "chat",
    "yippie_module_marketing": "marketing",
    "yippie_module_departments": "departments",
    "yippie_module_billing": "billing",
}

# Core modules always included regardless of add-on subscriptions.
CORE_MODULES = ["inbox", "contacts", "activity"]


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

    if tenant.stripe_customer_id:
        params["customer"] = tenant.stripe_customer_id
    else:
        params["customer_creation"] = "always"

    session = await asyncio.to_thread(stripe.checkout.Session.create, **params)
    return session["url"]


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
