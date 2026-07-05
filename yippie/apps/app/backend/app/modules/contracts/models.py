from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, LargeBinary, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, deferred, mapped_column
from sqlalchemy.sql import func

from app.database import Base

# Stored as plain strings (not PG enum types) so the raw-SQL migration stays
# simple and new statuses never need an ALTER TYPE. Validated at the app layer
# by the Pydantic schemas.
CONTRACT_STATUSES = ("draft", "sent", "active", "expired", "terminated")
CONTRACT_DIRECTIONS = ("issued", "received")


class Contract(Base):
    __tablename__ = "contracts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)

    title: Mapped[str] = mapped_column(String(255), nullable=False)
    contract_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="draft")
    # issued = we send it to our customer; received = a vendor/supplier contract we hold.
    direction: Mapped[str] = mapped_column(String(20), nullable=False, default="issued")

    # Counterparty — a company and/or contact already in the CRM, with a free-text
    # fallback for parties that aren't stored as records yet.
    company_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("companies.id", ondelete="SET NULL"), nullable=True
    )
    contact_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contacts.id", ondelete="SET NULL"), nullable=True
    )
    counterparty_name: Mapped[str | None] = mapped_column(String(255), nullable=True)

    owner_user_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    tags: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Uploaded document. Bytes live in the same row but are deferred so list/get
    # queries never drag the blob across the wire — only the download endpoint
    # undefers file_data.
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_data: Mapped[bytes | None] = deferred(mapped_column(LargeBinary, nullable=True))

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
