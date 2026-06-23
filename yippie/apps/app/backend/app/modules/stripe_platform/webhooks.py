from __future__ import annotations

import logging

import stripe as _stripe
from fastapi import Request, Response
from fastapi.routing import APIRouter
from sqlalchemy import select, update

from app.config import get_settings
from app.core.models import Tenant
from app.database import get_db
from app.modules.stripe_platform import service

log = logging.getLogger(__name__)

webhook_router = APIRouter(tags=["stripe-webhooks"])


@webhook_router.post("/stripe/webhooks/platform", include_in_schema=False)
async def stripe_platform_webhook(request: Request):
    """Stripe webhook — Layer 1 (Yippie SaaS billing events).
    Mounted without auth middleware so Stripe can POST directly."""
    settings = get_settings()
    payload = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    if settings.stripe_webhook_secret_platform:
        try:
            event = _stripe.Webhook.construct_event(
                payload, sig_header, settings.stripe_webhook_secret_platform
            )
        except _stripe.errors.SignatureVerificationError:
            log.warning("Stripe webhook signature verification failed")
            return Response(status_code=400)
    else:
        import json
        try:
            event = json.loads(payload)
        except Exception:
            return Response(status_code=400)

    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    async for db in get_db():
        try:
            if event_type == "checkout.session.completed":
                await _handle_checkout_completed(db, data)
            elif event_type in ("customer.subscription.created", "customer.subscription.updated"):
                await _handle_subscription_updated(db, data)
            elif event_type == "customer.subscription.deleted":
                await _handle_subscription_deleted(db, data)
            elif event_type == "invoice.paid":
                await _handle_invoice_paid(db, data)
            elif event_type == "invoice.payment_failed":
                await _handle_payment_failed(db, data)
        except Exception:
            log.exception("Error handling Stripe event %s", event_type)
            return Response(status_code=500)

    return Response(status_code=200)


async def _find_tenant_by_stripe_customer(db, customer_id: str) -> Tenant | None:
    result = await db.execute(
        select(Tenant).where(Tenant.stripe_customer_id == customer_id)
    )
    return result.scalar_one_or_none()


async def _find_tenant_by_metadata(db, metadata: dict) -> Tenant | None:
    tenant_id = metadata.get("tenant_id")
    if not tenant_id:
        return None
    result = await db.execute(select(Tenant).where(Tenant.id == tenant_id))
    return result.scalar_one_or_none()


async def _handle_checkout_completed(db, session: dict) -> None:
    customer_id = session.get("customer")
    subscription_id = session.get("subscription")
    metadata = session.get("metadata") or {}

    tenant = await _find_tenant_by_metadata(db, metadata)
    if tenant is None and customer_id:
        tenant = await _find_tenant_by_stripe_customer(db, customer_id)
    if tenant is None:
        log.warning("checkout.session.completed: no tenant found for session %s", session.get("id"))
        return

    updates: dict = {}
    if customer_id and not tenant.stripe_customer_id:
        updates["stripe_customer_id"] = customer_id
    if subscription_id and not tenant.stripe_subscription_id:
        updates["stripe_subscription_id"] = subscription_id

    if updates:
        await db.execute(update(Tenant).where(Tenant.id == tenant.id).values(**updates))
        await db.commit()
        log.info("checkout.session.completed: stored customer/subscription IDs for tenant %s", tenant.slug)


async def _handle_subscription_updated(db, subscription: dict) -> None:
    customer_id = subscription.get("customer")
    metadata = (subscription.get("metadata") or {})

    tenant = await _find_tenant_by_metadata(db, metadata)
    if tenant is None and customer_id:
        tenant = await _find_tenant_by_stripe_customer(db, customer_id)
    if tenant is None:
        log.warning("subscription.updated: no tenant found for customer %s", customer_id)
        return

    await service.sync_subscription_to_tenant(db, tenant, subscription)


async def _handle_subscription_deleted(db, subscription: dict) -> None:
    customer_id = subscription.get("customer")
    tenant = await _find_tenant_by_stripe_customer(db, customer_id)
    if tenant is None:
        return

    await db.execute(
        update(Tenant)
        .where(Tenant.id == tenant.id)
        .values(
            stripe_subscription_status="canceled",
            plan="founder",
        )
    )
    await db.commit()
    log.info("subscription.deleted: tenant %s downgraded to founder", tenant.slug)


async def _handle_invoice_paid(db, invoice: dict) -> None:
    """Reset AI scan counter at the start of a new billing period."""
    from datetime import datetime, timezone
    customer_id = invoice.get("customer")
    tenant = await _find_tenant_by_stripe_customer(db, customer_id)
    if tenant is None:
        return

    await db.execute(
        update(Tenant)
        .where(Tenant.id == tenant.id)
        .values(
            ai_scans_used_this_period=0,
            ai_scans_period_start=datetime.now(timezone.utc),
        )
    )
    await db.commit()
    log.info("invoice.paid: reset AI scan counter for tenant %s", tenant.slug)


async def _handle_payment_failed(db, invoice: dict) -> None:
    customer_id = invoice.get("customer")
    tenant = await _find_tenant_by_stripe_customer(db, customer_id)
    if tenant is None:
        return

    await db.execute(
        update(Tenant).where(Tenant.id == tenant.id).values(stripe_subscription_status="past_due")
    )
    await db.commit()
    log.warning("invoice.payment_failed: tenant %s marked past_due", tenant.slug)
