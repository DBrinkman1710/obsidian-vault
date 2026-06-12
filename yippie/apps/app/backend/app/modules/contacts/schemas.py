from __future__ import annotations

import uuid
from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field

COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"


class CompanyCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    domain: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None


class CompanyUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=255)
    domain: Optional[str] = Field(default=None, max_length=255)
    notes: Optional[str] = None


class CompanyOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    domain: Optional[str] = None
    notes: Optional[str] = None
    contact_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}


class CompanyContactOut(BaseModel):
    id: uuid.UUID
    full_name: str
    email: Optional[str] = None

    model_config = {"from_attributes": True}


class ContactLabelCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(default="#64748b", pattern=COLOR_PATTERN)


class ContactLabelUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=100)
    color: Optional[str] = Field(default=None, pattern=COLOR_PATTERN)


class ContactLabelOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    name: str
    color: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ContactCreate(BaseModel):
    full_name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    company_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None
    label_ids: Optional[list[uuid.UUID]] = None


class ContactUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company_id: Optional[uuid.UUID] = None
    notes: Optional[str] = None
    tags: Optional[list[str]] = None
    custom_fields: Optional[dict] = None
    label_ids: Optional[list[uuid.UUID]] = None


class ContactOut(BaseModel):
    id: uuid.UUID
    tenant_id: uuid.UUID
    full_name: str
    email: Optional[str]
    phone: Optional[str]
    # Full Company entity, read from the ORM `company_rel` relationship.
    company: Optional[CompanyOut] = Field(default=None, validation_alias="company_rel")
    notes: Optional[str]
    tags: Optional[list[str]]
    custom_fields: Optional[dict]
    labels: list[ContactLabelOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class ContactList(BaseModel):
    items: list[ContactOut]
    total: int


class ImportResult(BaseModel):
    imported: int = 0
    skipped: int = 0
    errors: int = 0
    error_details: list[str] = []
