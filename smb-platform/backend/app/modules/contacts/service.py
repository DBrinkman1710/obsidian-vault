from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.contacts.models import Contact
from app.modules.contacts.schemas import ContactCreate, ContactUpdate


async def list_contacts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 50,
) -> tuple[list[Contact], int]:
    q = select(Contact).where(Contact.tenant_id == tenant_id)
    if search:
        term = f"%{search}%"
        q = q.where(
            Contact.full_name.ilike(term)
            | Contact.email.ilike(term)
            | Contact.company.ilike(term)
        )
    total = await db.scalar(select(func.count()).select_from(q.subquery()))
    result = await db.execute(q.order_by(Contact.created_at.desc()).offset(skip).limit(limit))
    return result.scalars().all(), total or 0


async def get_contact(db: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID) -> Optional[Contact]:
    result = await db.execute(
        select(Contact).where(Contact.tenant_id == tenant_id, Contact.id == contact_id)
    )
    return result.scalar_one_or_none()


async def create_contact(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID, data: ContactCreate
) -> Contact:
    contact = Contact(tenant_id=tenant_id, created_by=created_by, **data.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact


async def update_contact(
    db: AsyncSession, contact: Contact, data: ContactUpdate
) -> Contact:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(contact, field, value)
    await db.commit()
    await db.refresh(contact)
    return contact


async def delete_contact(db: AsyncSession, contact: Contact) -> None:
    await db.delete(contact)
    await db.commit()
