from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import DateTime, Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class ShipmentStatus(str, enum.Enum):
    registered = "registered"
    in_transit = "in_transit"
    out_for_delivery = "out_for_delivery"
    delivered = "delivered"
    exception = "exception"
    returned = "returned"
    cancelled = "cancelled"


class Carrier(str, enum.Enum):
    sendcloud = "sendcloud"
    postnl = "postnl"
    dhl = "dhl"
    dpd = "dpd"
    ups = "ups"
    fedex = "fedex"
    other = "other"


class Shipment(Base):
    __tablename__ = "shipments"
    __table_args__ = (
        Index("ix_shipments_tenant_status", "tenant_id", "status"),
        Index("ix_shipments_tenant_carrier", "tenant_id", "carrier"),
        Index("ix_shipments_tenant_order_ref", "tenant_id", "order_reference"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    tracking_number: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    carrier: Mapped[Carrier] = mapped_column(Enum(Carrier), nullable=False, default=Carrier.other)
    status: Mapped[ShipmentStatus] = mapped_column(
        Enum(ShipmentStatus), nullable=False, default=ShipmentStatus.registered
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id"), nullable=True, index=True
    )
    order_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    estimated_delivery: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_event_description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_event_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_event_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sendcloud_parcel_id: Mapped[str | None] = mapped_column(String(100), nullable=True, index=True)
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_by: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ShipmentEvent(Base):
    __tablename__ = "shipment_events"
    __table_args__ = (
        Index("ix_shipment_events_shipment_ts", "shipment_id", "event_at"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    shipment_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("shipments.id", ondelete="CASCADE"), nullable=False
    )
    event_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    status_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    description: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
