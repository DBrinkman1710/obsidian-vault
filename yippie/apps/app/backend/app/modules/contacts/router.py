from __future__ import annotations

import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.modules.contacts import service
from app.modules.contacts.schemas import ContactCreate, ContactList, ContactOut, ContactUpdate

router = APIRouter(prefix="/contacts", tags=["contacts"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("", response_model=ContactList)
async def list_contacts(
    current_user: CurrentUser,
    db: DB,
    search: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
):
    items, total = await service.list_contacts(db, current_user.tenant_id, search, skip, limit)
    return ContactList(items=items, total=total)


@router.post("", response_model=ContactOut, status_code=status.HTTP_201_CREATED)
async def create_contact(body: ContactCreate, current_user: CurrentUser, db: DB):
    return await service.create_contact(db, current_user.tenant_id, current_user.id, body)


@router.get("/{contact_id}", response_model=ContactOut)
async def get_contact(contact_id: uuid.UUID, current_user: CurrentUser, db: DB):
    contact = await service.get_contact(db, current_user.tenant_id, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return contact


@router.patch("/{contact_id}", response_model=ContactOut)
async def update_contact(contact_id: uuid.UUID, body: ContactUpdate, current_user: CurrentUser, db: DB):
    contact = await service.get_contact(db, current_user.tenant_id, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    return await service.update_contact(db, contact, body)


@router.delete("/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(contact_id: uuid.UUID, current_user: CurrentUser, db: DB):
    contact = await service.get_contact(db, current_user.tenant_id, contact_id)
    if not contact:
        raise HTTPException(status_code=404, detail="Contact not found")
    await service.delete_contact(db, contact)
