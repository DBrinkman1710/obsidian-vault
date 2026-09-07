"""[YIP-KB] knowledge base endpoints — admin only, mounted behind the "ai" module gate.

The require_module("ai") dependency is applied at mount time in app/main.py
(this router is not in the MODULES registry — "knowledge" is not a sellable
module, it ships with the ai module).
"""
from __future__ import annotations

from typing import Annotated, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser
from app.database import get_db
from app.modules.knowledge import service
from app.modules.knowledge.schemas import KbSourceIn, KbSourceOut

router = APIRouter(prefix="/knowledge", tags=["knowledge"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/source", response_model=Optional[KbSourceOut])
async def get_source(current_user: AdminUser, db: DB):
    """The tenant's current knowledge source + status + chunk count (null when unset)."""
    return await service.source_out(db, current_user.tenant_id)


@router.put("/source", response_model=KbSourceOut)
async def set_source(body: KbSourceIn, background_tasks: BackgroundTasks, current_user: AdminUser, db: DB):
    """Set or replace the source URL; the fetch runs as a background task."""
    source = await service.set_source(db, current_user.tenant_id, body.url)
    await db.commit()
    background_tasks.add_task(service.fetch_source, current_user.tenant_id, source.id)
    return await service.source_out(db, current_user.tenant_id)


@router.post("/source/refetch", response_model=KbSourceOut)
async def refetch_source(background_tasks: BackgroundTasks, current_user: AdminUser, db: DB):
    source = await service.get_source(db, current_user.tenant_id)
    if source is None:
        raise HTTPException(status_code=404, detail="No knowledge source configured")
    await service.mark_pending(db, source)
    await db.commit()
    background_tasks.add_task(service.fetch_source, current_user.tenant_id, source.id)
    return await service.source_out(db, current_user.tenant_id)


@router.delete("/source")
async def delete_source(current_user: AdminUser, db: DB):
    deleted = await service.delete_source(db, current_user.tenant_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="No knowledge source configured")
    await db.commit()
    return {"deleted": True}
