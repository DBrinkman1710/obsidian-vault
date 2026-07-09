from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from app.modules.shipments.models import Carrier, ShipmentStatus


class ShipmentCreate(BaseModel):
    tracking_number: Optional[str] = None
    carrier: Carrier = Carrier.other
    contact_id: Optional[uuid.UUID] = None
    order_reference: Optional[str] = None
    notes: Optional[str] = None


class ShipmentUpdate(BaseModel):
    notes: Optional[str] = None
    contact_id: Optional[uuid.UUID] = None
    order_reference: Optional[str] = None
    carrier: Optional[Carrier] = None
    status: Optional[ShipmentStatus] = None


class ShipmentEventOut(BaseModel):
    id: uuid.UUID
    shipment_id: uuid.UUID
    event_at: datetime
    location: Optional[str]
    status_code: Optional[str]
    description: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ShipmentOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    tracking_number: Optional[str]
    carrier: Carrier
    status: ShipmentStatus
    contact_id: Optional[uuid.UUID]
    order_reference: Optional[str]
    notes: Optional[str]
    estimated_delivery: Optional[datetime]
    last_event_description: Optional[str]
    last_event_at: Optional[datetime]
    last_event_location: Optional[str]
    sendcloud_parcel_id: Optional[str]
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ShipmentDetail(ShipmentOut):
    events: list[ShipmentEventOut] = []


class ShipmentList(BaseModel):
    items: list[ShipmentOut]
    total: int


class SendcloudSettingsUpdate(BaseModel):
    sendcloud_api_key: Optional[str] = None
    sendcloud_api_secret: Optional[str] = None


class SendcloudSettingsOut(BaseModel):
    sendcloud_api_key_set: bool
    sendcloud_api_secret_set: bool
    sendcloud_webhook_url: str


class ErpOrderPayload(BaseModel):
    order_number: str
    tracking_number: Optional[str] = None
    carrier: Carrier = Carrier.other
    status: ShipmentStatus = ShipmentStatus.registered
    contact_email: Optional[str] = None
    contact_name: Optional[str] = None
    contact_phone: Optional[str] = None
    description: Optional[str] = None
    estimated_delivery: Optional[datetime] = None


class WebhookSettingsOut(BaseModel):
    orders_webhook_url: str
    orders_webhook_secret_set: bool
