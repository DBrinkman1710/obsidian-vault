from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, String, Text, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from app.database import Base


class EmailAccount(Base):
    """A Gmail/Outlook mailbox linked via OAuth.

    user_id NULL = tenant-level shared mailbox (e.g. support@acme.com);
    user_id set  = an agent's personal mailbox. Tokens are Fernet-encrypted
    (app.core.crypto) — never returned by any API endpoint.
    """

    __tablename__ = "email_accounts"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), nullable=False)
    user_id: Mapped[uuid.UUID | None] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # 'gmail' | 'outlook'
    email_address: Mapped[str] = mapped_column(String(255), nullable=False)  # lowercased
    display_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    refresh_token_encrypted: Mapped[str] = mapped_column(Text, nullable=False)
    access_token_encrypted: Mapped[str | None] = mapped_column(Text, nullable=True)
    access_token_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Space-joined scopes actually granted (Google can partially grant)
    scopes: Mapped[str | None] = mapped_column(Text, nullable=True)
    # gmail: {"history_id": "..."}; outlook: {"delta_link": "..."}; plus
    # a "consecutive_failures" counter maintained by the sync job
    sync_state: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    last_synced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active", server_default="active")
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    __table_args__ = (
        UniqueConstraint("tenant_id", "email_address", name="uq_email_accounts_tenant_address"),
        Index("ix_email_accounts_tenant_user", "tenant_id", "user_id"),
    )
