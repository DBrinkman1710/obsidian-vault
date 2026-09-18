"""Worker self-service availability endpoints.

Mounted OUTSIDE the module gate loop in main.py (like email_accounts_router) so
contract workers — who are restricted from every module by RBAC — can still reach
their own availability. Each endpoint is scoped to the calling user's own row.
"""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from datetime import date

from app.auth.dependencies import CurrentUser
from app.database import get_db
from app.modules.booking import service
from app.modules.booking.schemas import (
    ClaimRequest,
    DateAvailabilityOut,
    DateAvailabilityUpsert,
    WorkerAvailabilityOut,
    WorkerAvailabilityUpdate,
    WorkerContextOut,
    WorkerRequestOut,
)

router = APIRouter(prefix="/worker", tags=["worker"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/my-availability", response_model=WorkerAvailabilityOut)
async def get_my_availability(current_user: CurrentUser, db: DB):
    return await service.get_or_create_worker_availability(
        db, current_user.tenant_id, current_user.id
    )


@router.put("/my-availability", response_model=WorkerAvailabilityOut)
async def update_my_availability(
    body: WorkerAvailabilityUpdate, current_user: CurrentUser, db: DB
):
    return await service.update_worker_availability(
        db, current_user.tenant_id, current_user.id, body
    )


@router.get("/my-availability/exceptions", response_model=list[DateAvailabilityOut])
async def list_my_availability_exceptions(
    current_user: CurrentUser,
    db: DB,
    start: date = Query(..., description="Range start (inclusive, YYYY-MM-DD)"),
    end: date = Query(..., description="Range end (inclusive, YYYY-MM-DD)"),
):
    return await service.list_worker_exceptions_range(
        db, current_user.tenant_id, current_user.id, start, end
    )


@router.put("/my-availability/exceptions/{day}", response_model=DateAvailabilityOut)
async def upsert_my_availability_exception(
    day: date, body: DateAvailabilityUpsert, current_user: CurrentUser, db: DB
):
    return await service.upsert_worker_exception(
        db, current_user.tenant_id, current_user.id, day, body.slots
    )


@router.delete(
    "/my-availability/exceptions/{day}", status_code=status.HTTP_204_NO_CONTENT
)
async def delete_my_availability_exception(day: date, current_user: CurrentUser, db: DB):
    await service.delete_worker_exception(
        db, current_user.tenant_id, current_user.id, day
    )


@router.get("/context", response_model=WorkerContextOut)
async def get_context(current_user: CurrentUser, db: DB):
    """Tells the worker shell which screen to render (availability vs requests)."""
    settings = await service.get_or_create_settings(db, current_user.tenant_id)
    return WorkerContextOut(
        booking_direction=getattr(settings, "booking_direction", "availability"),
        request_fulfillment=getattr(settings, "request_fulfillment", "dispatcher"),
    )


def _first_name(full_name: str | None) -> str | None:
    return (full_name or "").split(" ")[0] or None


@router.get("/requests", response_model=list[WorkerRequestOut])
async def list_open_requests(current_user: CurrentUser, db: DB):
    """Open requests a worker can self-claim. Empty unless the tenant is in
    requests + self_claim mode."""
    settings = await service.get_or_create_settings(db, current_user.tenant_id)
    if (
        getattr(settings, "booking_direction", "availability") != "requests"
        or getattr(settings, "request_fulfillment", "dispatcher") != "self_claim"
    ):
        return []
    from app.modules.contacts.models import Contact
    from sqlalchemy import select

    reqs = await service.list_open_requests(db, current_user.tenant_id)
    contact_ids = {r.contact_id for r in reqs}
    names: dict[uuid.UUID, str] = {}
    if contact_ids:
        rows = await db.execute(select(Contact.id, Contact.full_name).where(Contact.id.in_(contact_ids)))
        names = {r.id: r.full_name for r in rows}
    return [
        WorkerRequestOut(
            id=r.id,
            contact_first_name=_first_name(names.get(r.contact_id)),
            requested_slots=r.requested_slots or [],
            message=r.message,
            created_at=r.created_at,
        )
        for r in reqs
    ]


@router.post("/requests/{request_id}/claim", status_code=201)
async def claim_request(request_id: uuid.UUID, body: ClaimRequest, current_user: CurrentUser, db: DB):
    settings = await service.get_or_create_settings(db, current_user.tenant_id)
    if (
        getattr(settings, "booking_direction", "availability") != "requests"
        or getattr(settings, "request_fulfillment", "dispatcher") != "self_claim"
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Claiming is not enabled.")
    try:
        event = await service.claim_request(
            db, current_user.tenant_id, request_id, current_user.id, body.slot_start, body.slot_end
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    return {"event_id": str(event.id)}
