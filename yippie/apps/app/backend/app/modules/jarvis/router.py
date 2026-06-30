from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.core.models import Tenant, UserReminder
from app.database import get_db
from app.modules.jarvis import service
from app.modules.jarvis.schemas import CaptureRequest, CaptureResponse, ReminderOut

router = APIRouter(prefix="/jarvis", tags=["jarvis"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.post("/capture", response_model=CaptureResponse)
async def capture(body: CaptureRequest, current_user: CurrentUser, db: DB):
    if not body.body.strip():
        raise HTTPException(status_code=400, detail="Input is empty")
    tenant = await db.get(Tenant, current_user.tenant_id)
    if tenant is None:
        raise HTTPException(status_code=404, detail="Tenant not found")

    plan = await service.classify(body.body, body.context_type, body.context_id, tenant)
    result = await service.execute(
        db, current_user, tenant, body.body, body.context_type, body.context_id, plan
    )
    return CaptureResponse(**result)


@router.get("/reminders", response_model=list[ReminderOut])
async def list_reminders(current_user: CurrentUser, db: DB):
    result = await db.execute(
        select(UserReminder)
        .where(UserReminder.user_id == current_user.id, UserReminder.dismissed_at.is_(None))
        .order_by(UserReminder.remind_at)
    )
    return result.scalars().all()


@router.patch("/reminders/{reminder_id}/dismiss")
async def dismiss_reminder(reminder_id: uuid.UUID, current_user: CurrentUser, db: DB):
    reminder = await db.get(UserReminder, reminder_id)
    if not reminder or reminder.user_id != current_user.id:
        raise HTTPException(status_code=404, detail="Reminder not found")
    reminder.dismissed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"dismissed": True}
