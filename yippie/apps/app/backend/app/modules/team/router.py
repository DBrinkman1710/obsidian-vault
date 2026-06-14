from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser
from app.core.mailer import ResendNotConfiguredError
from app.database import get_db
from app.modules.team import schemas, service

router = APIRouter(prefix="/team", tags=["team"])

DB = Annotated[AsyncSession, Depends(get_db)]


@router.get("/users", response_model=list[schemas.TeamUserOut])
async def list_team_users(current_user: AdminUser, db: DB):
    return await service.list_users(db, current_user.tenant_id)


@router.post("/invite", status_code=status.HTTP_201_CREATED)
async def invite_team_user(current_user: AdminUser, db: DB, data: schemas.TeamInviteRequest):
    try:
        return await service.invite_user(db, current_user.tenant_id, data.email, data.full_name, data.role)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except ResendNotConfiguredError as e:
        raise HTTPException(status_code=503, detail=str(e))


@router.patch("/users/{user_id}", response_model=schemas.TeamUserOut)
async def update_team_user(current_user: AdminUser, db: DB, user_id: uuid.UUID, data: schemas.TeamUserUpdate):
    try:
        return await service.update_user(db, current_user.tenant_id, user_id, current_user, data.is_active, data.role)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/users/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team_user(current_user: AdminUser, db: DB, user_id: uuid.UUID):
    try:
        await service.delete_user(db, current_user.tenant_id, user_id, current_user)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=404, detail=str(e))
