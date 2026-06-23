from __future__ import annotations

from typing import Annotated, Optional

from fastapi import Depends, HTTPException
from fastapi.routing import APIRouter
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.config import get_settings
from app.core.models import Tenant
from app.database import get_db
from app.modules.stripe_platform import service

router = APIRouter(prefix="/stripe", tags=["stripe"])

DB = Annotated[AsyncSession, Depends(get_db)]


def _require_stripe():
    if not get_settings().stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured on this environment.")


class CheckoutRequest(BaseModel):
    plan: str
    interval: str = "monthly"
    modules: list[str] = []


class CheckoutResponse(BaseModel):
    checkout_url: str


class PortalResponse(BaseModel):
    portal_url: str


class SubscriptionStatusResponse(BaseModel):
    plan: str
    stripe_subscription_status: Optional[str]
    stripe_customer_id: Optional[str]
    ai_scans_used_this_period: int
    ai_scans_limit: Optional[int]


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(
    body: CheckoutRequest,
    current_user: CurrentUser,
    db: DB,
):
    _require_stripe()
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = get_settings()
    base = settings.effective_base_url or "https://app.getyippie.com"
    success_url = f"{base}/settings/subscription?checkout=success"
    cancel_url = f"{base}/settings/subscription"

    try:
        url = await service.create_checkout_session(
            tenant=tenant,
            plan=body.plan,
            interval=body.interval,
            module_add_ons=body.modules,
            success_url=success_url,
            cancel_url=cancel_url,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return CheckoutResponse(checkout_url=url)


@router.post("/portal", response_model=PortalResponse)
async def create_portal(
    current_user: CurrentUser,
    db: DB,
):
    _require_stripe()
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    settings = get_settings()
    base = settings.effective_base_url or "https://app.getyippie.com"
    return_url = f"{base}/settings/subscription"

    try:
        url = await service.create_portal_session(tenant=tenant, return_url=return_url)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    return PortalResponse(portal_url=url)


@router.get("/subscription", response_model=SubscriptionStatusResponse)
async def get_subscription(
    current_user: CurrentUser,
    db: DB,
):
    from app.core.plans import limits_for_plan
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    limits = limits_for_plan(tenant.plan)
    return SubscriptionStatusResponse(
        plan=tenant.plan,
        stripe_subscription_status=tenant.stripe_subscription_status,
        stripe_customer_id=tenant.stripe_customer_id,
        ai_scans_used_this_period=tenant.ai_scans_used_this_period,
        ai_scans_limit=limits.get("ai_scans"),
    )
