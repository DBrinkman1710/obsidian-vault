from __future__ import annotations

import re
import uuid
from typing import Annotated, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.modules.contracts import service
from app.modules.contracts.schemas import (
    BulkDeleteRequest,
    ContractCreate,
    ContractOut,
    ContractUpdate,
)

router = APIRouter(prefix="/contracts", tags=["contracts"])
DB = Annotated[AsyncSession, Depends(get_db)]

ALLOWED_FILE_TYPES = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}


@router.get("", response_model=list[ContractOut])
async def list_contracts(
    current_user: CurrentUser,
    db: DB,
    company_id: Optional[uuid.UUID] = Query(None),
    contact_id: Optional[uuid.UUID] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    direction: Optional[str] = Query(None),
):
    return await service.list_contracts(
        db,
        current_user.tenant_id,
        company_id=company_id,
        contact_id=contact_id,
        status=status_filter,
        direction=direction,
    )


@router.post("", response_model=ContractOut, status_code=status.HTTP_201_CREATED)
async def create_contract(body: ContractCreate, current_user: CurrentUser, db: DB):
    return await service.create_contract(db, current_user.tenant_id, current_user.id, body)


# Static path declared before "/{contract_id}" so FastAPI does not read "bulk" as a UUID.
@router.delete("/bulk")
async def bulk_delete_contracts(body: BulkDeleteRequest, current_user: CurrentUser, db: DB):
    deleted = await service.bulk_delete(db, current_user.tenant_id, body.ids)
    return {"deleted": deleted}


@router.get("/{contract_id}", response_model=ContractOut)
async def get_contract(contract_id: uuid.UUID, current_user: CurrentUser, db: DB):
    contract = await service.get_contract(db, current_user.tenant_id, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.patch("/{contract_id}", response_model=ContractOut)
async def update_contract(contract_id: uuid.UUID, body: ContractUpdate, current_user: CurrentUser, db: DB):
    contract = await service.update_contract(db, current_user.tenant_id, contract_id, body)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.delete("/{contract_id}")
async def delete_contract(contract_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ok = await service.delete_contract(db, current_user.tenant_id, contract_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Contract not found")
    return {"deleted": True}


@router.post("/{contract_id}/file", response_model=ContractOut)
async def upload_file(
    contract_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
    file: UploadFile = File(...),
):
    if file.content_type not in ALLOWED_FILE_TYPES:
        raise HTTPException(status_code=400, detail="Only PDF, Word, or image files are supported")
    data = await file.read()
    if len(data) > service.MAX_FILE_BYTES:
        raise HTTPException(status_code=400, detail="File is larger than 15 MB")
    if not data:
        raise HTTPException(status_code=400, detail="File is empty")
    contract = await service.set_file(
        db,
        current_user.tenant_id,
        contract_id,
        data=data,
        file_name=file.filename or "contract",
        file_type=file.content_type,
    )
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.delete("/{contract_id}/file", response_model=ContractOut)
async def delete_file(contract_id: uuid.UUID, current_user: CurrentUser, db: DB):
    contract = await service.clear_file(db, current_user.tenant_id, contract_id)
    if not contract:
        raise HTTPException(status_code=404, detail="Contract not found")
    return contract


@router.get("/{contract_id}/file")
async def download_file(contract_id: uuid.UUID, current_user: CurrentUser, db: DB):
    contract = await service.get_file(db, current_user.tenant_id, contract_id)
    if not contract or not contract.file_data:
        raise HTTPException(status_code=404, detail="No file attached")
    safe_name = re.sub(r'[^\w\-.]', '_', contract.file_name or "contract")[:80]
    return StreamingResponse(
        iter([contract.file_data]),
        media_type=contract.file_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}"'},
    )
