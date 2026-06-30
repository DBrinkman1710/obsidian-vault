from __future__ import annotations

import hmac
import logging
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.config import get_settings
from app.database import get_db
from app.modules.shipments import service
from app.modules.shipments.models import Carrier, ShipmentStatus
from app.modules.shipments.schemas import (
    SendcloudSettingsOut,
    SendcloudSettingsUpdate,
    ShipmentCreate,
    ShipmentDetail,
    ShipmentList,
    ShipmentOut,
    ShipmentUpdate,
    WebhookSettingsOut,
)

log = logging.getLogger(__name__)

router = APIRouter(prefix="/shipments", tags=["shipments"])
webhook_router = APIRouter(prefix="/webhooks/shipments", tags=["shipments-webhooks"])

DB = Annotated[AsyncSession, Depends(get_db)]


# Settings endpoints — must be declared before /{id} to avoid being captured as an ID

@router.get("/settings/webhook", response_model=WebhookSettingsOut)
async def get_webhook_settings(current_user: AdminUser, db: DB):
    from app.core.models import Tenant
    settings = get_settings()
    tenant = await db.get(Tenant, current_user.tenant_id)
    slug = tenant.slug if tenant else ""
    return await service.get_erp_webhook_settings(db, current_user.tenant_id, settings.effective_base_url, slug)


@router.post("/settings/webhook/rotate", response_model=WebhookSettingsOut)
async def rotate_webhook_secret(current_user: AdminUser, db: DB):
    from app.core.models import Tenant
    settings = get_settings()
    tenant = await db.get(Tenant, current_user.tenant_id)
    slug = tenant.slug if tenant else ""
    try:
        result = await service.rotate_erp_webhook_secret(db, current_user.tenant_id, settings.effective_base_url, slug)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await db.commit()
    return result


@router.get("/settings/sendcloud", response_model=SendcloudSettingsOut)
async def get_sendcloud_settings(current_user: CurrentUser, db: DB):
    from app.core.models import Tenant
    settings = get_settings()
    tenant = await db.get(Tenant, current_user.tenant_id)
    slug = tenant.slug if tenant else ""
    return await service.get_sendcloud_settings(
        db, current_user.tenant_id, settings.effective_base_url, slug
    )


@router.patch("/settings/sendcloud", response_model=SendcloudSettingsOut)
async def update_sendcloud_settings(
    body: SendcloudSettingsUpdate, current_user: AdminUser, db: DB
):
    try:
        result = await service.update_sendcloud_settings(db, current_user.tenant_id, body)
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    await db.commit()
    return result


# List + create

@router.get("", response_model=ShipmentList)
async def list_shipments(
    current_user: CurrentUser,
    db: DB,
    shipment_status: Optional[ShipmentStatus] = Query(None, alias="status"),
    carrier: Optional[Carrier] = Query(None),
    contact_id: Optional[uuid.UUID] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    items, total = await service.list_shipments(
        db, current_user.tenant_id,
        status=shipment_status,
        carrier=carrier,
        contact_id=contact_id,
        skip=skip,
        limit=limit,
    )
    return ShipmentList(items=items, total=total)


@router.post("", response_model=ShipmentOut, status_code=status.HTTP_201_CREATED)
async def create_shipment(body: ShipmentCreate, current_user: CurrentUser, db: DB):
    shipment = await service.create_shipment(db, current_user.tenant_id, current_user.id, body)
    await db.commit()
    return shipment


# Detail endpoints

@router.get("/{shipment_id}", response_model=ShipmentDetail)
async def get_shipment(shipment_id: uuid.UUID, current_user: CurrentUser, db: DB):
    detail = await service.get_shipment_with_events(db, current_user.tenant_id, shipment_id)
    if not detail:
        raise HTTPException(status_code=404, detail="Shipment not found")
    return detail


@router.patch("/{shipment_id}", response_model=ShipmentOut)
async def update_shipment(
    shipment_id: uuid.UUID, body: ShipmentUpdate, current_user: CurrentUser, db: DB
):
    shipment = await service.get_shipment_orm(db, current_user.tenant_id, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    result = await service.update_shipment(db, shipment, body)
    await db.commit()
    return result


@router.post("/{shipment_id}/delete", status_code=status.HTTP_200_OK)
async def delete_shipment(shipment_id: uuid.UUID, current_user: AdminUser, db: DB):
    shipment = await service.get_shipment_orm(db, current_user.tenant_id, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    await service.soft_delete_shipment(db, shipment)
    await db.commit()
    return {"deleted": True}


@router.post("/{shipment_id}/refresh", response_model=ShipmentDetail)
async def refresh_shipment(shipment_id: uuid.UUID, current_user: CurrentUser, db: DB):
    shipment = await service.get_shipment_orm(db, current_user.tenant_id, shipment_id)
    if not shipment:
        raise HTTPException(status_code=404, detail="Shipment not found")
    try:
        result = await service.refresh_from_sendcloud(db, current_user.tenant_id, shipment)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        log.exception("Sendcloud refresh failed for shipment %s", shipment_id)
        raise HTTPException(status_code=502, detail=f"Sendcloud API error: {e}")
    await db.commit()
    return result


# Public webhooks — no auth

@webhook_router.post("/orders/{tenant_slug}", include_in_schema=False)
async def erp_orders_webhook(tenant_slug: str, request: Request, db: DB):
    from app.core.models import Tenant
    from sqlalchemy import select
    from app.modules.shipments.schemas import ErpOrderPayload

    tenant = await db.scalar(select(Tenant).where(Tenant.slug == tenant_slug))
    if not tenant:
        return Response(status_code=200)

    if tenant.orders_webhook_secret:
        api_key = request.headers.get("X-Api-Key", "")
        if not hmac.compare_digest(api_key, tenant.orders_webhook_secret):
            return Response(status_code=403, content="Invalid API key")

    try:
        data = await request.json()
        payload = ErpOrderPayload(**data)
    except Exception:
        return Response(status_code=200)

    try:
        await service.handle_erp_order_webhook(db, tenant.id, payload)
        await db.commit()
    except Exception:
        log.exception("ERP orders webhook failed for tenant %s", tenant_slug)
        await db.rollback()

    return Response(status_code=200)


@webhook_router.post("/sendcloud/{tenant_slug}", include_in_schema=False)
async def sendcloud_webhook(tenant_slug: str, request: Request, db: DB):
    from app.core.models import Tenant
    from sqlalchemy import select

    body = await request.body()
    signature = request.headers.get("sendcloud-signature", "")

    tenant = await db.scalar(
        select(Tenant).where(Tenant.slug == tenant_slug)
    )
    if not tenant:
        return Response(status_code=200)

    if tenant.sendcloud_api_secret:
        if not service.verify_sendcloud_signature(tenant.sendcloud_api_secret, body, signature):
            return Response(status_code=403, content="Invalid signature")

    try:
        payload = await request.json()
    except Exception:
        return Response(status_code=200)

    try:
        await service.handle_sendcloud_webhook(db, tenant.id, payload)
        await db.commit()
    except Exception:
        log.exception("Failed to process Sendcloud webhook for tenant %s", tenant_slug)
        await db.rollback()

    return Response(status_code=200)
