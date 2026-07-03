from __future__ import annotations

import os
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.modules.external_calendar import service
from app.modules.external_calendar.schemas import (
    ExternalCalendarFeedCreate,
    ExternalCalendarFeedOut,
    ExternalCalendarFeedUpdate,
)

router = APIRouter(tags=["external-calendar"])

DB = Annotated[AsyncSession, Depends(get_db)]

CLIENT_BASE_URL = os.environ.get("CLIENT_BASE_URL", "https://sandbox.getyippie.com")


@router.get("/external-calendars", response_model=list[ExternalCalendarFeedOut])
async def list_feeds(current_user: CurrentUser, db: DB):
    return await service.list_feeds(db, current_user.tenant_id, current_user.id)


@router.post("/external-calendars", response_model=ExternalCalendarFeedOut, status_code=status.HTTP_201_CREATED)
async def create_feed(body: ExternalCalendarFeedCreate, current_user: CurrentUser, db: DB):
    try:
        return await service.create_feed(db, current_user.tenant_id, current_user.id, body)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.patch("/external-calendars/{feed_id}", response_model=ExternalCalendarFeedOut)
async def update_feed(feed_id: uuid.UUID, body: ExternalCalendarFeedUpdate, current_user: CurrentUser, db: DB):
    feed = await service.update_feed(db, current_user.tenant_id, current_user.id, feed_id, body)
    if feed is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found.")
    return feed


@router.delete("/external-calendars/{feed_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_feed(feed_id: uuid.UUID, current_user: CurrentUser, db: DB):
    ok = await service.delete_feed(db, current_user.tenant_id, current_user.id, feed_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found.")


@router.post("/external-calendars/{feed_id}/sync")
async def sync_feed(feed_id: uuid.UUID, current_user: CurrentUser, db: DB):
    from sqlalchemy import select
    from app.modules.external_calendar.models import ExternalCalendarFeed

    feed = await db.scalar(
        select(ExternalCalendarFeed).where(
            ExternalCalendarFeed.id == feed_id,
            ExternalCalendarFeed.tenant_id == current_user.tenant_id,
            ExternalCalendarFeed.user_id == current_user.id,
        )
    )
    if feed is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Feed not found.")
    try:
        count = await service.sync_feed(db, feed)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_502_BAD_GATEWAY, detail=str(exc))
    return {"synced_count": count}


@router.get("/external-calendars/my-feed-url")
async def get_my_feed_url(current_user: CurrentUser):
    return {
        "ical_url": f"{CLIENT_BASE_URL}/api/v1/public/calendar/{current_user.calendar_feed_token}.ics"
    }


@router.post("/external-calendars/my-feed-url/regenerate")
async def regenerate_feed_token(current_user: CurrentUser, db: DB):
    import uuid as _uuid
    from app.core.models import User
    from sqlalchemy import update

    new_token = _uuid.uuid4()
    await db.execute(
        update(User).where(User.id == current_user.id).values(calendar_feed_token=new_token)
    )
    await db.commit()
    return {
        "ical_url": f"{CLIENT_BASE_URL}/api/v1/public/calendar/{new_token}.ics"
    }
