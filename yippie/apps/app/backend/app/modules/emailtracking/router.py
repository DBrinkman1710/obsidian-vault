from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.modules.emailtracking.schemas import OutboundEmailOut
from app.modules.emailtracking import service

router = APIRouter(prefix="/emailtracking", tags=["emailtracking"])
DB = Annotated[AsyncSession, Depends(get_db)]

@router.get("/outbound", response_model=list[OutboundEmailOut])
async def list_outbound(current_user: CurrentUser, db: DB, limit: int = 200):
    return await service.list_outbound(db, tenant_id=current_user.tenant_id, limit=limit)
