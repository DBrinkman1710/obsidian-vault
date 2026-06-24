from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.database import get_db
from app.modules.pipeline import service
from app.modules.pipeline.schemas import (
    BulkMoveToStage,
    MoveToStage,
    PipelineBoardColumn,
    PipelineReorder,
    PipelineStageCreate,
    PipelineStageOut,
    PipelineStageUpdate,
)

router = APIRouter(prefix="/pipeline", tags=["pipeline"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/stages", response_model=list[PipelineStageOut])
async def list_stages(current_user: CurrentUser, db: DB):
    return await service.list_stages(db, current_user.tenant_id)


@router.post("/stages", response_model=PipelineStageOut, status_code=status.HTTP_201_CREATED)
async def create_stage(body: PipelineStageCreate, current_user: AdminUser, db: DB):
    return await service.create_stage(db, current_user.tenant_id, body)


@router.put("/stages/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_stages(body: PipelineReorder, current_user: AdminUser, db: DB):
    await service.reorder_stages(db, current_user.tenant_id, body.ids)


@router.patch("/stages/{stage_id}", response_model=PipelineStageOut)
async def update_stage(stage_id: uuid.UUID, body: PipelineStageUpdate, current_user: AdminUser, db: DB):
    stage = await service.get_stage(db, current_user.tenant_id, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    return await service.update_stage(db, stage, body)


@router.delete("/stages/{stage_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_stage(stage_id: uuid.UUID, current_user: AdminUser, db: DB):
    stage = await service.get_stage(db, current_user.tenant_id, stage_id)
    if not stage:
        raise HTTPException(status_code=404, detail="Stage not found")
    await service.delete_stage(db, stage)


@router.get("/board", response_model=list[PipelineBoardColumn])
async def get_board(current_user: CurrentUser, db: DB):
    return await service.get_board(db, current_user.tenant_id)


@router.put("/contacts/bulk-stage", status_code=status.HTTP_204_NO_CONTENT)
async def bulk_move_to_stage(body: BulkMoveToStage, current_user: CurrentUser, db: DB):
    try:
        await service.bulk_move_contacts_to_stage(
            db, current_user.tenant_id, body.contact_ids, body.stage_id, actor_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.put("/contacts/{contact_id}/stage", status_code=status.HTTP_204_NO_CONTENT)
async def move_to_stage(contact_id: uuid.UUID, body: MoveToStage, current_user: CurrentUser, db: DB):
    try:
        await service.move_contact_to_stage(
            db, current_user.tenant_id, contact_id, body.stage_id, actor_id=current_user.id
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/contacts/{contact_id}/stage", status_code=status.HTTP_204_NO_CONTENT)
async def remove_from_pipeline(contact_id: uuid.UUID, current_user: CurrentUser, db: DB):
    await service.remove_contact_from_pipeline(db, current_user.tenant_id, contact_id)


@router.get("/contacts/{contact_id}/stage", response_model=PipelineStageOut | None)
async def get_contact_stage(contact_id: uuid.UUID, current_user: CurrentUser, db: DB):
    return await service.get_contact_stage(db, current_user.tenant_id, contact_id)
