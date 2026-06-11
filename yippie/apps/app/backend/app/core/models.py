from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.database import Base


class UserRole(str, enum.Enum):
    superadmin = "superadmin"
    admin = "admin"
    agent = "agent"
    viewer = "viewer"


_ALL_MODULES = ["contacts", "tickets", "billing", "activity", "inbox", "chat", "ai"]


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    enabled_modules: Mapped[list[str]] = mapped_column(
        ARRAY(String), nullable=False, default=lambda: list(_ALL_MODULES)
    )
    primary_color: Mapped[str] = mapped_column(String(20), nullable=False, default="#5BB8E8")
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_demo: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    go_live_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    inbound_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    users: Mapped[list[User]] = relationship("User", back_populates="tenant")


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("tenants.id"), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    hashed_password: Mapped[str] = mapped_column(Text, nullable=False)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), nullable=False, default=UserRole.agent)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    reply_from_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    # Personal Yippie receiving address on the Resend domain (e.g. klimaatexamen-eddy@getyippie.com).
    # Mail forwarded here lands in this user's personal inbox instead of the tenant's shared one.
    inbound_email: Mapped[str | None] = mapped_column(String(255), unique=True, nullable=True)
    # Personal signature appended to compose/reply (plain text; rendered into the HTML layout on send)
    email_signature: Mapped[str | None] = mapped_column(Text, nullable=True)
    # Per-user toggle for keyboard shortcuts (e.g. Cmd/Ctrl+Enter to send). Off = no hotkeys fire.
    hotkeys_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    tenant: Mapped[Tenant] = relationship("Tenant", back_populates="users")
