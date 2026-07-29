from __future__ import annotations

import hashlib
import hmac
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional

import httpx
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.shipments.models import Carrier, Shipment, ShipmentEvent, ShipmentStatus
from app.modules.shipments.schemas import (
    ErpOrderPayload,
    SendcloudSettingsOut,
    SendcloudSettingsUpdate,
    ShipmentCreate,
    ShipmentDetail,
    ShipmentOut,
    ShipmentUpdate,
    WebhookSettingsOut,
)

log = logging.getLogger(__name__)

# Sendcloud parcel status ID → ShipmentStatus
_SENDCLOUD_STATUS_MAP: dict[int, ShipmentStatus] = {
    1: ShipmentStatus.registered,
    12: ShipmentStatus.in_transit,
    13: ShipmentStatus.in_transit,
    14: ShipmentStatus.in_transit,
    15: ShipmentStatus.in_transit,
    17: ShipmentStatus.in_transit,
    11: ShipmentStatus.out_for_delivery,
    2000: ShipmentStatus.delivered,
    1000: ShipmentStatus.exception,
    2700: ShipmentStatus.exception,
    8: ShipmentStatus.returned,
    2100: ShipmentStatus.cancelled,
}


def _map_sendcloud_status(status_id: int) -> ShipmentStatus:
    return _SENDCLOUD_STATUS_MAP.get(status_id, ShipmentStatus.in_transit)


async def _upsert_event(
    db: AsyncSession,
    shipment: Shipment,
    event_at: datetime,
    description: str,
    location: Optional[str] = None,
    status_code: Optional[str] = None,
) -> None:
    existing = await db.scalar(
        select(ShipmentEvent.id).where(
            ShipmentEvent.shipment_id == shipment.id,
            ShipmentEvent.event_at == event_at,
            ShipmentEvent.status_code == status_code,
        )
    )
    if existing:
        return
    db.add(ShipmentEvent(
        tenant_id=shipment.tenant_id,
        shipment_id=shipment.id,
        event_at=event_at,
        location=location,
        status_code=status_code,
        description=description[:500],
    ))


def _parse_sendcloud_date(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except Exception:
        return None


def _update_shipment_from_parcel(shipment: Shipment, parcel: dict) -> None:
    status_obj = parcel.get("status") or {}
    status_id = status_obj.get("id") if isinstance(status_obj, dict) else None
    if status_id is not None:
        shipment.status = _map_sendcloud_status(int(status_id))

    shipment.sendcloud_parcel_id = str(parcel.get("id", "")) or shipment.sendcloud_parcel_id

    status_msg = status_obj.get("message") if isinstance(status_obj, dict) else None
    if status_msg:
        shipment.last_event_description = str(status_msg)[:500]

    shipment.estimated_delivery = _parse_sendcloud_date(parcel.get("expected_delivery_date"))

    updated_at_str = parcel.get("updated_at") or parcel.get("date_updated")
    updated_at = _parse_sendcloud_date(updated_at_str)
    if updated_at:
        shipment.last_event_at = updated_at


async def list_shipments(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    status: Optional[ShipmentStatus] = None,
    carrier: Optional[Carrier] = None,
    contact_id: Optional[uuid.UUID] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[ShipmentOut], int]:
    q = select(Shipment).where(
        Shipment.tenant_id == tenant_id,
        Shipment.deleted_at.is_(None),
    )
    if status:
        q = q.where(Shipment.status == status)
    if carrier:
        q = q.where(Shipment.carrier == carrier)
    if contact_id:
        q = q.where(Shipment.contact_id == contact_id)
    if date_from:
        q = q.where(Shipment.created_at >= date_from)
    if date_to:
        q = q.where(Shipment.created_at <= date_to)

    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    rows = await db.scalars(q.order_by(Shipment.created_at.desc()).offset(skip).limit(limit))
    return [ShipmentOut.model_validate(r) for r in rows], total or 0


async def create_shipment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    created_by: uuid.UUID,
    body: ShipmentCreate,
) -> ShipmentOut:
    shipment = Shipment(
        tenant_id=tenant_id,
        created_by=created_by,
        tracking_number=body.tracking_number.strip() if body.tracking_number else None,
        carrier=body.carrier,
        contact_id=body.contact_id,
        order_reference=body.order_reference,
        notes=body.notes,
    )
    db.add(shipment)
    await db.flush()
    await db.refresh(shipment)
    return ShipmentOut.model_validate(shipment)


async def get_shipment_orm(
    db: AsyncSession, tenant_id: uuid.UUID, shipment_id: uuid.UUID
) -> Shipment | None:
    return await db.scalar(
        select(Shipment).where(
            Shipment.id == shipment_id,
            Shipment.tenant_id == tenant_id,
            Shipment.deleted_at.is_(None),
        )
    )


async def get_shipment_with_events(
    db: AsyncSession, tenant_id: uuid.UUID, shipment_id: uuid.UUID
) -> ShipmentDetail | None:
    from app.modules.shipments.schemas import ShipmentEventOut

    shipment = await get_shipment_orm(db, tenant_id, shipment_id)
    if not shipment:
        return None
    events = list(await db.scalars(
        select(ShipmentEvent)
        .where(ShipmentEvent.shipment_id == shipment_id)
        .order_by(ShipmentEvent.event_at.asc())
    ))
    detail = ShipmentDetail.model_validate(shipment)
    detail.events = [ShipmentEventOut.model_validate(e) for e in events]
    return detail


async def update_shipment(
    db: AsyncSession, shipment: Shipment, body: ShipmentUpdate
) -> ShipmentOut:
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(shipment, field, value)
    await db.flush()
    await db.refresh(shipment)
    return ShipmentOut.model_validate(shipment)


async def soft_delete_shipment(db: AsyncSession, shipment: Shipment) -> None:
    shipment.deleted_at = datetime.now(timezone.utc)
    await db.flush()


async def refresh_from_sendcloud(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    shipment: Shipment,
) -> ShipmentDetail:
    from app.core.models import Tenant

    tenant = await db.get(Tenant, tenant_id)
    if not tenant or not tenant.sendcloud_api_key or not tenant.sendcloud_api_secret:
        raise ValueError("Sendcloud API credentials not configured")

    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.get(
            "https://panel.sendcloud.sc/api/v2/parcels",
            params={"tracking_number": shipment.tracking_number},
            auth=(tenant.sendcloud_api_key, tenant.sendcloud_api_secret),
        )

    if resp.status_code == 404:
        raise LookupError("Tracking number not found in Sendcloud")
    resp.raise_for_status()

    data = resp.json()
    parcels = data.get("parcels", [])
    if not parcels:
        raise LookupError("Tracking number not found in Sendcloud")

    parcel = parcels[0]
    _update_shipment_from_parcel(shipment, parcel)

    for status_entry in parcel.get("statuses", []):
        ts = _parse_sendcloud_date(
            status_entry.get("date") or status_entry.get("timestamp")
        )
        if ts is None:
            ts = datetime.now(timezone.utc)
        desc = str(status_entry.get("message") or status_entry.get("description") or "")[:500]
        code = str(status_entry.get("id", ""))
        loc = status_entry.get("city") or status_entry.get("location") or None
        await _upsert_event(db, shipment, ts, desc, loc, code)

    await db.flush()
    await db.refresh(shipment)
    return await get_shipment_with_events(db, tenant_id, shipment.id)


async def handle_sendcloud_webhook(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: dict,
) -> None:
    from app.database import set_tenant_context

    await set_tenant_context(db, str(tenant_id))

    parcel = payload.get("parcel") or {}
    tracking_number = parcel.get("tracking_number")
    if not tracking_number:
        return

    shipment = await db.scalar(
        select(Shipment).where(
            Shipment.tenant_id == tenant_id,
            Shipment.tracking_number == tracking_number,
        ).order_by(Shipment.created_at.desc())
    )
    if not shipment:
        shipment = Shipment(
            tenant_id=tenant_id,
            tracking_number=tracking_number,
            carrier=Carrier.sendcloud,
        )
        db.add(shipment)
        await db.flush()

    _update_shipment_from_parcel(shipment, parcel)

    status_obj = parcel.get("status") or {}
    ts_str = parcel.get("updated_at") or parcel.get("date_updated")
    ts = _parse_sendcloud_date(ts_str) or datetime.now(timezone.utc)
    desc = str(status_obj.get("message") or "") or "Status update"
    code = str(status_obj.get("id", ""))
    await _upsert_event(db, shipment, ts, desc, None, code)

    await db.flush()


def verify_sendcloud_signature(secret: str, body: bytes, signature: str) -> bool:
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def get_sendcloud_settings(
    db: AsyncSession, tenant_id: uuid.UUID, app_base_url: str, slug: str
) -> SendcloudSettingsOut:
    from app.core.models import Tenant

    tenant = await db.get(Tenant, tenant_id)
    return SendcloudSettingsOut(
        sendcloud_api_key_set=bool(tenant and tenant.sendcloud_api_key),
        sendcloud_api_secret_set=bool(tenant and tenant.sendcloud_api_secret),
        sendcloud_webhook_url=f"{app_base_url}/api/v1/webhooks/shipments/sendcloud/{slug}",
    )


async def handle_erp_order_webhook(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    payload: ErpOrderPayload,
) -> None:
    from app.database import set_tenant_context
    from app.modules.contacts.models import Contact
    from app.modules.contacts.service import _normalize_phone

    await set_tenant_context(db, str(tenant_id))

    shipment = await db.scalar(
        select(Shipment).where(
            Shipment.tenant_id == tenant_id,
            Shipment.order_reference == payload.order_number,
            Shipment.deleted_at.is_(None),
        ).order_by(Shipment.created_at.desc())
    )

    contact: Contact | None = None
    contact_id = None
    if payload.contact_email:
        email_norm = payload.contact_email.lower().strip()
        contact = await db.scalar(
            select(Contact).where(
                Contact.tenant_id == tenant_id,
                Contact.email == email_norm,
                Contact.deleted_at.is_(None),
            )
        )
        if contact:
            # Merge-only: fill in blank fields, never overwrite existing data.
            if payload.contact_name and not contact.full_name:
                contact.full_name = payload.contact_name
            if payload.contact_phone and not contact.phone:
                contact.phone = _normalize_phone(payload.contact_phone)
            await db.flush()
            contact_id = contact.id
        else:
            # New contact — create from order data.
            full_name = (payload.contact_name or "").strip() or email_norm.split("@")[0]
            contact = Contact(
                tenant_id=tenant_id,
                full_name=full_name,
                email=email_norm,
                phone=_normalize_phone(payload.contact_phone) if payload.contact_phone else None,
                tags=["order-system"],
            )
            db.add(contact)
            await db.flush()
            contact_id = contact.id

    now = datetime.now(timezone.utc)

    if shipment is None:
        shipment = Shipment(
            tenant_id=tenant_id,
            order_reference=payload.order_number,
            tracking_number=payload.tracking_number,
            carrier=payload.carrier,
            status=payload.status,
            contact_id=contact_id,
            estimated_delivery=payload.estimated_delivery,
            last_event_description=payload.description[:500] if payload.description else None,
            last_event_at=now if payload.description else None,
        )
        db.add(shipment)
    else:
        if payload.tracking_number is not None:
            shipment.tracking_number = payload.tracking_number
        shipment.carrier = payload.carrier
        shipment.status = payload.status
        if contact_id:
            shipment.contact_id = contact_id
        if payload.estimated_delivery:
            shipment.estimated_delivery = payload.estimated_delivery
        if payload.description:
            shipment.last_event_description = payload.description[:500]
            shipment.last_event_at = now

    await db.flush()

    # [FLOW7] order received from the ERP — same transaction as the shipment write.
    from app.core.flow_events import emit_flow_event

    await emit_flow_event(
        db, tenant_id, "order_received",
        entity_type="shipment", entity_id=shipment.id,
        contact_id=contact_id,
        payload={
            "order_number": payload.order_number,
            "status": payload.status.value if hasattr(payload.status, "value") else payload.status,
            "carrier": payload.carrier,
            "tracking_number": payload.tracking_number,
            "contact_id": contact_id,
        },
    )

    # [FLOW8] the hardcoded order-status → pipeline stage move (and its
    # moved_by_human guard) was retired. Tenants now wire this via flows on the
    # order_received trigger with a status condition + move contact to stage. The
    # migration backfilled one such flow per previously-configured stage column.
    # NOTE: flows semantics apply now — a flow-driven move has no moved_by_human
    # guard, so it will move the contact even if a human placed them in a stage.


async def get_erp_webhook_settings(
    db: AsyncSession, tenant_id: uuid.UUID, base_url: str, slug: str
) -> WebhookSettingsOut:
    from app.core.models import Tenant

    tenant = await db.get(Tenant, tenant_id)
    return WebhookSettingsOut(
        orders_webhook_url=f"{base_url}/api/v1/webhooks/shipments/orders/{slug}",
        orders_webhook_secret_set=bool(tenant and tenant.orders_webhook_secret),
    )


async def rotate_erp_webhook_secret(
    db: AsyncSession, tenant_id: uuid.UUID, base_url: str, slug: str
) -> WebhookSettingsOut:
    import secrets as _secrets
    from app.core.models import Tenant

    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise LookupError("Tenant not found")

    tenant.orders_webhook_secret = _secrets.token_urlsafe(32)
    await db.flush()

    return WebhookSettingsOut(
        orders_webhook_url=f"{base_url}/api/v1/webhooks/shipments/orders/{slug}",
        orders_webhook_secret_set=True,
    )


async def update_sendcloud_settings(
    db: AsyncSession, tenant_id: uuid.UUID, body: SendcloudSettingsUpdate
) -> SendcloudSettingsOut:
    from app.core.models import Tenant
    from app.config import get_settings

    tenant = await db.get(Tenant, tenant_id)
    if not tenant:
        raise LookupError("Tenant not found")

    if body.sendcloud_api_key is not None:
        tenant.sendcloud_api_key = body.sendcloud_api_key or None
    if body.sendcloud_api_secret is not None:
        tenant.sendcloud_api_secret = body.sendcloud_api_secret or None

    await db.flush()

    settings = get_settings()
    return SendcloudSettingsOut(
        sendcloud_api_key_set=bool(tenant.sendcloud_api_key),
        sendcloud_api_secret_set=bool(tenant.sendcloud_api_secret),
        sendcloud_webhook_url=f"{settings.effective_base_url}/api/v1/webhooks/shipments/sendcloud/{tenant.slug}",
    )
