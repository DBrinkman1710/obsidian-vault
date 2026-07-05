from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import undefer

from app.modules.contacts.models import Company, Contact
from app.modules.contracts.models import Contract
from app.modules.contracts.schemas import ContractCreate, ContractUpdate

MAX_FILE_BYTES = 15 * 1024 * 1024  # 15 MB — a signed PDF is comfortably under this


async def _attach_names(db: AsyncSession, tenant_id: uuid.UUID, contracts: list[Contract]) -> None:
    """Resolve company_id / contact_id to display names in one query each."""
    company_ids = {c.company_id for c in contracts if c.company_id}
    contact_ids = {c.contact_id for c in contracts if c.contact_id}

    companies: dict[uuid.UUID, str] = {}
    if company_ids:
        rows = await db.execute(
            select(Company.id, Company.name).where(
                Company.tenant_id == tenant_id, Company.id.in_(company_ids)
            )
        )
        companies = {cid: name for cid, name in rows.all()}

    contacts: dict[uuid.UUID, str] = {}
    if contact_ids:
        rows = await db.execute(
            select(Contact.id, Contact.full_name).where(
                Contact.tenant_id == tenant_id, Contact.id.in_(contact_ids)
            )
        )
        contacts = {cid: name for cid, name in rows.all()}

    for c in contracts:
        c.company_name = companies.get(c.company_id) if c.company_id else None
        c.contact_name = contacts.get(c.contact_id) if c.contact_id else None


async def list_contracts(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    *,
    company_id: Optional[uuid.UUID] = None,
    contact_id: Optional[uuid.UUID] = None,
    status: Optional[str] = None,
    direction: Optional[str] = None,
) -> list[Contract]:
    stmt = select(Contract).where(Contract.tenant_id == tenant_id)
    if company_id:
        stmt = stmt.where(Contract.company_id == company_id)
    if contact_id:
        stmt = stmt.where(Contract.contact_id == contact_id)
    if status:
        stmt = stmt.where(Contract.status == status)
    if direction:
        stmt = stmt.where(Contract.direction == direction)
    stmt = stmt.order_by(Contract.created_at.desc())

    result = await db.execute(stmt)
    contracts = list(result.scalars().all())
    await _attach_names(db, tenant_id, contracts)
    return contracts


async def get_contract(
    db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID
) -> Optional[Contract]:
    result = await db.execute(
        select(Contract).where(Contract.id == contract_id, Contract.tenant_id == tenant_id)
    )
    contract = result.scalar_one_or_none()
    if contract:
        await _attach_names(db, tenant_id, [contract])
    return contract


async def create_contract(
    db: AsyncSession, tenant_id: uuid.UUID, created_by: uuid.UUID, body: ContractCreate
) -> Contract:
    contract = Contract(
        tenant_id=tenant_id,
        created_by=created_by,
        owner_user_id=body.owner_user_id or created_by,
        title=body.title,
        contract_type=body.contract_type,
        status=body.status,
        direction=body.direction,
        company_id=body.company_id,
        contact_id=body.contact_id,
        counterparty_name=body.counterparty_name,
        tags=body.tags,
        notes=body.notes,
    )
    db.add(contract)
    await db.commit()
    await db.refresh(contract)
    await _attach_names(db, tenant_id, [contract])
    return contract


async def update_contract(
    db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID, body: ContractUpdate
) -> Optional[Contract]:
    contract = await get_contract(db, tenant_id, contract_id)
    if not contract:
        return None
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(contract, field, value)
    await db.commit()
    await db.refresh(contract)
    await _attach_names(db, tenant_id, [contract])
    return contract


async def delete_contract(db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID) -> bool:
    contract = await db.execute(
        select(Contract.id).where(Contract.id == contract_id, Contract.tenant_id == tenant_id)
    )
    if contract.scalar_one_or_none() is None:
        return False
    await db.execute(delete(Contract).where(Contract.id == contract_id, Contract.tenant_id == tenant_id))
    await db.commit()
    return True


async def bulk_delete(db: AsyncSession, tenant_id: uuid.UUID, ids: list[uuid.UUID]) -> int:
    if not ids:
        return 0
    result = await db.execute(
        delete(Contract).where(Contract.tenant_id == tenant_id, Contract.id.in_(ids))
    )
    await db.commit()
    return result.rowcount or 0


async def set_file(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contract_id: uuid.UUID,
    *,
    data: bytes,
    file_name: str,
    file_type: str,
) -> Optional[Contract]:
    contract = await get_contract(db, tenant_id, contract_id)
    if not contract:
        return None
    contract.file_data = data
    contract.file_name = file_name
    contract.file_type = file_type
    contract.file_size = len(data)
    await db.commit()
    await db.refresh(contract)
    await _attach_names(db, tenant_id, [contract])
    return contract


async def clear_file(
    db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID
) -> Optional[Contract]:
    contract = await get_contract(db, tenant_id, contract_id)
    if not contract:
        return None
    contract.file_data = None
    contract.file_name = None
    contract.file_type = None
    contract.file_size = None
    await db.commit()
    await db.refresh(contract)
    await _attach_names(db, tenant_id, [contract])
    return contract


async def get_file(
    db: AsyncSession, tenant_id: uuid.UUID, contract_id: uuid.UUID
) -> Optional[Contract]:
    """Fetch a contract with its file bytes undeferred, for download."""
    result = await db.execute(
        select(Contract)
        .options(undefer(Contract.file_data))
        .where(Contract.id == contract_id, Contract.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()
