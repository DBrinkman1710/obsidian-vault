from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.database import get_db
from app.modules.pipeline import service
from app.modules.pipeline.schemas import (
    BulkMoveToStage,
    FlowchartGraph,
    FlowchartOut,
    FlowchartSuggestion,
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


# [KAN_FLOW1] Pipeline flowchart — the second Kanban view. The board stays the
# source of truth for the stage list; these two endpoints only store/return the
# visual layout, reconciled against the live stages on every read/write.
@router.get("/flowchart", response_model=FlowchartOut)
async def get_flowchart(current_user: CurrentUser, db: DB):
    return await service.get_flowchart(db, current_user.tenant_id)


@router.put("/flowchart", response_model=FlowchartOut)
async def put_flowchart(body: FlowchartGraph, current_user: AdminUser, db: DB):
    return await service.upsert_flowchart(db, current_user.tenant_id, body)


# [KAN_FLOW2] Draft automation suggestions derived from the chart's edges. Each
# maps a stage → stage transition (direct or via a decision diamond) to a
# prefill the Flows builder can open — the chart teaches GetYippie the pipeline and
# offers to wire the automations the user already drew.
@router.get("/flowchart/suggestions", response_model=list[FlowchartSuggestion])
async def get_flowchart_suggestions(current_user: CurrentUser, db: DB):
    return await service.get_flowchart_suggestions(db, current_user.tenant_id)


@router.get("/campaign_click_moves/{campaign_id}")
async def campaign_click_moves(campaign_id: uuid.UUID, current_user: AdminUser, db: DB):
    """Diagnostic: for every contact a campaign's tracked pipeline buttons were
    clicked for, compare the stage the click should have moved them to
    (intended) against the stage they are actually in on the board (current),
    so we can see which moves landed and which were lost.

    Also flags likely bots: a contact whose click burned tokens for more than
    one button is almost certainly an email security scanner (a human picks one
    button), so their clicks shouldn't be trusted as real intent."""
    from collections import defaultdict

    from sqlalchemy.orm import aliased

    from app.modules.contacts.models import Contact
    from app.modules.pipeline.models import ContactPipelineEntry, PipelineStage
    from app.modules.tracking.models import LabelClickToken

    IntendedStage = aliased(PipelineStage)
    CurrentStage = aliased(PipelineStage)

    rows = await db.execute(
        select(
            LabelClickToken.contact_id,
            Contact.full_name,
            Contact.email,
            LabelClickToken.button_id,
            LabelClickToken.stage_id.label("intended_stage_id"),
            IntendedStage.name.label("intended_stage"),
            LabelClickToken.used_at,
            ContactPipelineEntry.stage_id.label("current_stage_id"),
            CurrentStage.name.label("current_stage"),
            ContactPipelineEntry.moved_by_human,
        )
        .join(Contact, Contact.id == LabelClickToken.contact_id)
        .outerjoin(IntendedStage, IntendedStage.id == LabelClickToken.stage_id)
        .outerjoin(
            ContactPipelineEntry,
            (ContactPipelineEntry.contact_id == LabelClickToken.contact_id)
            & (ContactPipelineEntry.tenant_id == LabelClickToken.tenant_id),
        )
        .outerjoin(CurrentStage, CurrentStage.id == ContactPipelineEntry.stage_id)
        .where(
            LabelClickToken.tenant_id == current_user.tenant_id,
            LabelClickToken.campaign_id == campaign_id,
            LabelClickToken.used_at.isnot(None),
            LabelClickToken.action_type == "pipeline_stage",
        )
        .order_by(LabelClickToken.contact_id, LabelClickToken.used_at)
    )
    by_contact: dict = defaultdict(list)
    for r in rows.all():
        by_contact[r.contact_id].append(r)

    contacts = []
    moved = not_moved = bots = 0
    for cid, rs in by_contact.items():
        r0 = rs[0]
        buttons = sorted({r.button_id for r in rs})
        intended_ids = {str(r.intended_stage_id) for r in rs if r.intended_stage_id}
        intended_names = sorted({r.intended_stage for r in rs if r.intended_stage})
        current_id = str(r0.current_stage_id) if r0.current_stage_id else None
        landed = bool(current_id and current_id in intended_ids)
        is_bot = len(buttons) > 1
        times = [r.used_at for r in rs if r.used_at]
        if is_bot:
            bots += 1
        if landed:
            moved += 1
        else:
            not_moved += 1
        contacts.append({
            "contact_id": str(cid),
            "name": r0.full_name,
            "email": r0.email,
            "buttons_clicked": buttons,
            "intended_stages": intended_names,
            "current_stage": r0.current_stage,
            "moved_to_intended": landed,
            "placed_by_human": bool(r0.moved_by_human),
            "likely_bot": is_bot,
            "last_clicked_at": max(times).isoformat() if times else None,
        })

    contacts.sort(key=lambda c: (c["moved_to_intended"], c["likely_bot"]))
    return {
        "campaign_id": str(campaign_id),
        "total_clickers": len(contacts),
        "moved_to_intended": moved,
        "not_moved": not_moved,
        "likely_bots_multi_button": bots,
        "contacts": contacts,
    }
