"""Stripe-ready payment abstraction for new client signups.

Currently creates an invoice in the root tenant's Billing module so Diederik
can track and collect payment manually. When STRIPE_SECRET_KEY is configured,
swap this module to create a Stripe checkout session instead and return the
checkout URL for the frontend to redirect to.
"""
from __future__ import annotations

import uuid
from datetime import date, timedelta

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.plans import MODULE_PRICES, PLAN_LIMITS, _coerce_plan
from app.modules.billing.models import InvoiceStatus
from app.modules.billing.schemas import InvoiceCreate, LineItem


async def handle_signup_payment(
    db: AsyncSession,
    root_tenant_id: uuid.UUID,
    contact_id: uuid.UUID,
    plan: str,
    modules: list[str],
    company_name: str,
) -> dict:
    """Create billing record for a new signup.

    No Stripe: creates a not_sent invoice in root tenant billing.
    With Stripe (future): create checkout session and return redirect URL.
    """
    # TODO: When STRIPE_SECRET_KEY is configured and checkout is wired,
    # create a Stripe checkout session here and return {"type": "stripe", "checkout_url": ...}

    # ── Invoice path ───────────────────────────────────────────────────────────
    from app.modules.billing import service as billing_service

    plan_limits = PLAN_LIMITS.get(_coerce_plan(plan), {})
    plan_price = plan_limits.get("price_monthly") or 0

    line_items: list[LineItem] = [
        LineItem(
            description=f"Yippie {plan.title()} plan — {company_name}",
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
            description=f"Initial subscription — {company_name}",
        ),
    )
    # Caller owns the commit — do not commit here as it resets SET LOCAL tenant context.
    return {"type": "invoice", "invoice_id": str(invoice.id)}
