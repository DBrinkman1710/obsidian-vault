from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from decimal import Decimal

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, LargeBinary, Numeric, String, Text
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, deferred, mapped_column
from sqlalchemy.sql import func

from app.database import Base

# Stored as plain strings (not PG enum types) so the raw-SQL migration stays
# simple and new statuses never need an ALTER TYPE. Validated at the app layer
# by the Pydantic schemas.
CONTRACT_STATUSES = ("draft", "sent", "active", "expired", "terminated")
CONTRACT_DIRECTIONS = ("issued", "received")
CONTRACT_VALUE_INTERVALS = ("one_off", "monthly", "yearly")
CONTRACT_RENEWAL_TERMS = ("monthly", "yearly")


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

    # Uploaded document (CONTRACT1). Bytes are deferred so list/get queries
    # never drag the blob across the wire — only the download endpoint undefers.
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_data: Mapped[bytes | None] = deferred(mapped_column(LargeBinary, nullable=True))

    # Lifecycle ([CONTRACT2]). notice_deadline is derived, never stored.
    start_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    notice_period_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    auto_renew: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    # Term the scheduler rolls end_date forward by when auto_renew is on.
    renewal_term: Mapped[str | None] = mapped_column(String(10), nullable=True)

    # Contract value — shaped so a Stripe subscription can consume it in phase 3
    # (amount + interval + currency map straight onto a Stripe price).
    value_amount: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), nullable=True)
    value_interval: Mapped[str | None] = mapped_column(String(10), nullable=True)
    currency: Mapped[str] = mapped_column(String(3), nullable=False, default="EUR")

    # Scheduler dedupe — one nudge per deadline; cleared when end_date changes
    # (renewal roll forward or manual edit) so the next cycle nudges again.
    notice_reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    expiry_reminder_sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Generation + e-signing ([CONTRACT3]). body is the rendered contract text,
    # frozen at generation time — later template edits never change it.
    template_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("contract_templates.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Merge resolved copy of the template's blocks, frozen at generation time
    # ([TMPL1]) — the block PDF renderer's input. Never exposed to updates.
    rendered_blocks: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    # Public signing link (booking-token pattern → /sign/:token). Cleared on signature.
    sign_token: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True, unique=True)
    sign_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Signature audit trail. For legal-grade signing swap in eIDAS later.
    signed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    signer_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    signer_ip: Mapped[str | None] = mapped_column(String(64), nullable=True)
    signature_image: Mapped[str | None] = deferred(mapped_column(Text, nullable=True))  # PNG data URL

    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    @property
    def notice_deadline(self) -> date | None:
        """Last day to give notice: end_date − notice_period_days."""
        if self.end_date is None or self.notice_period_days is None:
            return None
        return self.end_date - timedelta(days=self.notice_period_days)


class ContractTemplate(Base):
    """Reusable contract layout with {{merge_field}} placeholders ([CONTRACT3]).

    Since [TMPL1] the source of truth is `blocks` (structured JSON edited in
    the drag and drop builder); `body` is kept as the flattened plain text
    projection (sign page, search, legacy PDF fallback) and is rewritten by
    the service on every save.
    """

    __tablename__ = "contract_templates"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False, default="")
    blocks: Mapped[dict] = mapped_column(
        JSONB, nullable=False, default=lambda: {"version": 1, "blocks": []}
    )
    schema_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    created_by: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
