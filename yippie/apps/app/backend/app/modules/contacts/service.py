from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.contacts.models import Contact, ContactLabel
from app.modules.contacts.schemas import (
    ContactCreate,
    ContactLabelCreate,
    ContactLabelUpdate,
    ContactUpdate,
)


async def list_contacts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
    label_id: Optional[uuid.UUID] = None,
) -> tuple[list[Contact], int]:
    q = select(Contact).where(Contact.tenant_id == tenant_id)
    if search:
        term = f"%{search}%"
        q = q.where(
            Contact.full_name.ilike(term)
            | Contact.email.ilike(term)
            | Contact.company.ilike(term)
        )
    if label_id:
        q = q.where(Contact.labels.any(ContactLabel.id == label_id))
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Contact.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all(), total or 0


async def get_contact(db: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID) -> Optional[Contact]:
    result = await db.execute(
        select(Contact).where(Contact.tenant_id == tenant_id, Contact.id == contact_id)
    )
    return result.scalar_one_or_none()


async def _resolve_labels(
    db: AsyncSession, tenant_id: uuid.UUID, label_ids: list[uuid.UUID]
) -> list[ContactLabel]:
    # Tenant filter drops cross-tenant/unknown ids silently.
    if not label_ids:
        return []
    result = await db.execute(
        select(ContactLabel).where(
            ContactLabel.tenant_id == tenant_id, ContactLabel.id.in_(label_ids)
        )
    )
    return result.scalars().all()


async def create_contact(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID, data: ContactCreate
) -> Contact:
    contact = Contact(
        tenant_id=tenant_id, created_by=created_by, **data.model_dump(exclude={"label_ids"})
    )
    if data.label_ids is not None:
        contact.labels = await _resolve_labels(db, tenant_id, data.label_ids)
    db.add(contact)
    await db.commit()
    # Re-fetch so the labels relationship is loaded for serialization.
    return await get_contact(db, tenant_id, contact.id)


async def update_contact(
    db: AsyncSession, contact: Contact, data: ContactUpdate
) -> Contact:
    fields = data.model_dump(exclude_unset=True, exclude={"label_ids"})
    for field, value in fields.items():
        setattr(contact, field, value)
    if "label_ids" in data.model_dump(exclude_unset=True):
        contact.labels = await _resolve_labels(db, contact.tenant_id, data.label_ids or [])
    await db.commit()
    return await get_contact(db, contact.tenant_id, contact.id)


async def delete_contact(db: AsyncSession, contact: Contact) -> None:
    await db.delete(contact)
    await db.commit()


# --- Contact labels (item 38) ---


async def list_labels(db: AsyncSession, tenant_id: uuid.UUID) -> list[ContactLabel]:
    result = await db.execute(
        select(ContactLabel)
        .where(ContactLabel.tenant_id == tenant_id)
        .order_by(ContactLabel.name)
    )
    return result.scalars().all()


async def get_label(db: AsyncSession, tenant_id: uuid.UUID, label_id: uuid.UUID) -> Optional[ContactLabel]:
    result = await db.execute(
        select(ContactLabel).where(
            ContactLabel.tenant_id == tenant_id, ContactLabel.id == label_id
        )
    )
    return result.scalar_one_or_none()


async def _label_name_taken(
    db: AsyncSession, tenant_id: uuid.UUID, name: str, exclude_id: Optional[uuid.UUID] = None
) -> bool:
    q = select(ContactLabel.id).where(
        ContactLabel.tenant_id == tenant_id,
        func.lower(ContactLabel.name) == name.lower(),
    )
    if exclude_id:
        q = q.where(ContactLabel.id != exclude_id)
    return (await db.execute(q.limit(1))).scalar_one_or_none() is not None


async def create_label(db: AsyncSession, tenant_id: uuid.UUID, body: ContactLabelCreate) -> ContactLabel:
    if await _label_name_taken(db, tenant_id, body.name):
        raise ValueError("A label with this name already exists")
    label = ContactLabel(tenant_id=tenant_id, name=body.name, color=body.color)
    db.add(label)
    await db.commit()
    await db.refresh(label)
    return label


async def update_label(db: AsyncSession, label: ContactLabel, body: ContactLabelUpdate) -> ContactLabel:
    fields = body.model_dump(exclude_unset=True)
    if "name" in fields and await _label_name_taken(db, label.tenant_id, fields["name"], exclude_id=label.id):
        raise ValueError("A label with this name already exists")
    for field, value in fields.items():
        setattr(label, field, value)
    await db.commit()
    await db.refresh(label)
    return label


async def delete_label(db: AsyncSession, label: ContactLabel) -> None:
    # contact_label_links rows are removed by ON DELETE CASCADE.
    await db.delete(label)
    await db.commit()
