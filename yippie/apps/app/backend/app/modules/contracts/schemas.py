from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ContractStatus = Literal["draft", "sent", "active", "expired", "terminated"]
ContractDirection = Literal["issued", "received"]
ContractValueInterval = Literal["one_off", "monthly", "yearly"]
ContractRenewalTerm = Literal["monthly", "yearly"]


class ContractCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    contract_type: Optional[str] = Field(None, max_length=100)
    status: ContractStatus = "draft"
    direction: ContractDirection = "issued"
    company_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    counterparty_name: Optional[str] = Field(None, max_length=255)
    owner_user_id: Optional[uuid.UUID] = None
    tags: list[str] = Field(default_factory=list)
    notes: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notice_period_days: Optional[int] = Field(None, ge=0, le=730)
    auto_renew: bool = False
    renewal_term: Optional[ContractRenewalTerm] = None
    value_amount: Optional[float] = Field(None, ge=0)
    value_interval: Optional[ContractValueInterval] = None
    currency: str = Field("EUR", min_length=3, max_length=3)


class ContractUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    contract_type: Optional[str] = Field(None, max_length=100)
    status: Optional[ContractStatus] = None
    direction: Optional[ContractDirection] = None
    company_id: Optional[uuid.UUID] = None
    contact_id: Optional[uuid.UUID] = None
    counterparty_name: Optional[str] = Field(None, max_length=255)
    owner_user_id: Optional[uuid.UUID] = None
    tags: Optional[list[str]] = None
    notes: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    notice_period_days: Optional[int] = Field(None, ge=0, le=730)
    auto_renew: Optional[bool] = None
    renewal_term: Optional[ContractRenewalTerm] = None
    value_amount: Optional[float] = Field(None, ge=0)
    value_interval: Optional[ContractValueInterval] = None
    currency: Optional[str] = Field(None, min_length=3, max_length=3)
    # Generated contract text ([CONTRACT3]) — editable until signed.
    body: Optional[str] = None


class ContractOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    contract_type: Optional[str]
    status: str
    direction: str
    company_id: Optional[uuid.UUID]
    contact_id: Optional[uuid.UUID]
    counterparty_name: Optional[str]
    # Resolved display names, attached by the service.
    company_name: Optional[str] = None
    contact_name: Optional[str] = None
    owner_user_id: Optional[uuid.UUID]
    tags: list[str]
    notes: Optional[str]
    file_name: Optional[str]
    file_type: Optional[str]
    file_size: Optional[int]
    start_date: Optional[date]
    end_date: Optional[date]
    notice_period_days: Optional[int]
    # Derived on the model: end_date − notice_period_days.
    notice_deadline: Optional[date] = None
    auto_renew: bool
    renewal_term: Optional[str]
    value_amount: Optional[float]
    value_interval: Optional[str]
    currency: str
    template_id: Optional[uuid.UUID] = None
    body: Optional[str] = None
    sign_token: Optional[uuid.UUID] = None
    sign_token_expires_at: Optional[datetime] = None
    signed_at: Optional[datetime] = None
    signer_name: Optional[str] = None
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class RenewalsSummary(BaseModel):
    """Live rollup of active contract value — the Billing module's MRR/ARR feed."""

    mrr: float
    arr: float
    one_off_total: float
    currency: str
    active_count: int
    expiring_soon_count: int
    auto_renewing_count: int
    expired_count: int


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID]


# ── Templates + e-signing ([CONTRACT3]) ──────────────────────────────────────


class TemplateCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    body: str = ""


class TemplateUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    body: Optional[str] = None


class TemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    name: str
    body: str
    created_at: datetime
    updated_at: datetime


class GenerateRequest(BaseModel):
    template_id: uuid.UUID


class SignLinkRequest(BaseModel):
    expires_days: int = Field(14, ge=1, le=90)


class SignLinkOut(BaseModel):
    sign_token: uuid.UUID
    sign_token_expires_at: datetime


class PublicContractOut(BaseModel):
    """What the counterparty sees on /sign/:token — no internal fields."""

    tenant_name: str
    title: str
    body: str
    counterparty_name: Optional[str]
    value_amount: Optional[float]
    value_interval: Optional[str]
    currency: str
    start_date: Optional[date]
    end_date: Optional[date]
    signed_at: Optional[datetime]
    signer_name: Optional[str]


class PublicSignRequest(BaseModel):
    signer_name: str = Field(..., min_length=2, max_length=255)
    # PNG data URL from the signature canvas; capped well below any sane drawing.
    signature_image: Optional[str] = Field(None, max_length=200_000)
    agree: bool
