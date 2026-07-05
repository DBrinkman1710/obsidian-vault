from __future__ import annotations

import uuid
from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ContractStatus = Literal["draft", "sent", "active", "expired", "terminated"]
ContractDirection = Literal["issued", "received"]


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
    created_by: Optional[uuid.UUID]
    created_at: datetime
    updated_at: datetime


class BulkDeleteRequest(BaseModel):
    ids: list[uuid.UUID]
