"""Payment abstraction for new client signups.

When Stripe is configured (`STRIPE_SECRET_KEY` set) this creates a Stripe Checkout
session for the new tenant and returns its URL so the frontend can redirect the
buyer straight to payment. Without Stripe — or if checkout can't be built (e.g. the
plan's price isn't in the Stripe dashboard yet) — it falls back to creating a
`not_sent` invoice in the root tenant's Billing module for manual collection.
"""
from __future__ import annotations

import logging
import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.plans import MODULE_PRICES, PLAN_LIMITS, _coerce_plan
from app.modules.billing.models import InvoiceStatus
from app.modules.billing.schemas import InvoiceCreate, LineItem

log = logging.getLogger(__name__)


async def handle_signup_payment(
    db: AsyncSession,
    root_tenant_id: uuid.UUID,
    contact_id: uuid.UUID,
    plan: str,
    modules: list[str],
    company_name: str,
    *,
    tenant=None,
    success_url: str | None = None,
    cancel_url: str | None = None,
) -> dict:
    """Collect payment for a new signup.

    With Stripe configured: create a Checkout session for ``tenant`` and return
    ``{"type": "stripe", "checkout_url": ...}``; the frontend redirects there.
    Otherwise — or on any Stripe error — create a ``not_sent`` invoice in
    root-tenant billing and return ``{"type": "invoice", "invoice_id": ...}``.
    """
    settings = get_settings()

    # ── Stripe Checkout path ─────────────────────────────────────────────────
    if settings.stripe_secret_key and tenant is not None:
        from app.modules.stripe_platform import service as stripe_service

        try:
            checkout_url = await stripe_service.create_checkout_session(
                tenant=tenant,
                plan=plan,
                interval="monthly",
                module_add_ons=modules,
                success_url=success_url or "",
                cancel_url=cancel_url or "",
            )
            return {"type": "stripe", "checkout_url": checkout_url}
        except Exception:
            # Missing price in the dashboard, Stripe API error, etc. Never fail
            # the signup over payment setup — fall back to a manual invoice so
            # the account still lands and Diederik can collect by hand.
            log.exception(
                "Stripe checkout unavailable for signup '%s'; falling back to invoice",
                company_name,
            )

    # ── Invoice fallback ─────────────────────────────────────────────────────
    from app.modules.billing import service as billing_service

    plan_limits = PLAN_LIMITS.get(_coerce_plan(plan), {})
    plan_price = plan_limits.get("price_monthly") or 0

    line_items: list[LineItem] = [
        LineItem(
            description=f"Yippie {plan.title()} plan for {company_name}",
            quantity=1,
            unit_price_cents=int(plan_price * 100),
        )
    ]
    for mod in modules:
        mod_price = MODULE_PRICES.get(mod)
        if mod_price:
            line_items.append(LineItem(
                description=f"{mod.replace('_', ' ').title()} module",
                quantity=1,
                unit_price_cents=int(mod_price * 100),
            ))

    invoice = await billing_service.create_invoice(
        db,
        root_tenant_id,
        InvoiceCreate(
            contact_id=contact_id,
            line_items=line_items,
            status=InvoiceStatus.not_sent,
            due_date=date.today() + timedelta(days=14),
            description=f"Initial subscription for {company_name}",
        ),
    )
    # Caller owns the commit — do not commit here as it resets SET LOCAL tenant context.
    return {"type": "invoice", "invoice_id": str(invoice.id)}
