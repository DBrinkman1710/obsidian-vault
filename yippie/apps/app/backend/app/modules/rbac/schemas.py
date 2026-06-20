from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel

from app.core.models import AccessLevel, PermSubjectType


class RbacRoleOut(BaseModel):
    id: uuid.UUID
    name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RbacRoleCreate(BaseModel):
    name: str


class PermissionsMatrixOut(BaseModel):
    id: uuid.UUID
    subject_type: PermSubjectType
    subject_id: uuid.UUID
    module: str
    access_level: AccessLevel

    model_config = {"from_attributes": True}


class PermissionsMatrixUpsert(BaseModel):
    subject_type: PermSubjectType
    subject_id: uuid.UUID
    module: str
    access_level: AccessLevel


class UserRbacRoleOut(BaseModel):
    id: uuid.UUID
    role_id: uuid.UUID
    role_name: str


class MyPermissionsOut(BaseModel):
    permissions: dict[str, str]
