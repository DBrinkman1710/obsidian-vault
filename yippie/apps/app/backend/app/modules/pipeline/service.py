from __future__ import annotations

import uuid
from typing import Optional

from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.contacts.models import Company, Contact
from app.modules.pipeline.models import ContactPipelineEntry, PipelineStage
from app.modules.pipeline.schemas import (
    PipelineBoardColumn,
    PipelineBoardContact,
    PipelineStageCreate,
    PipelineStageOut,
    PipelineStageUpdate,
)


async def list_stages(db: AsyncSession, tenant_id: uuid.UUID) -> list[PipelineStageOut]:
    count_q = (
        select(ContactPipelineEntry.stage_id, func.count().label("cnt"))
        .where(ContactPipelineEntry.tenant_id == tenant_id)
        .group_by(ContactPipelineEntry.stage_id)
        .subquery()
    )
    result = await db.execute(
        select(PipelineStage, func.coalesce(count_q.c.cnt, 0).label("cnt"))
        .outerjoin(count_q, PipelineStage.id == count_q.c.stage_id)
        .where(PipelineStage.tenant_id == tenant_id)
        .order_by(PipelineStage.display_order)
    )
    out = []
    for stage, cnt in result.all():
        o = PipelineStageOut.model_validate(stage)
        o.contact_count = int(cnt)
        out.append(o)
    return out


async def get_stage(db: AsyncSession, tenant_id: uuid.UUID, stage_id: uuid.UUID) -> Optional[PipelineStage]:
    result = await db.execute(
        select(PipelineStage).where(PipelineStage.tenant_id == tenant_id, PipelineStage.id == stage_id)
    )
    return result.scalar_one_or_none()


async def create_stage(
    db: AsyncSession, tenant_id: uuid.UUID, data: PipelineStageCreate
) -> PipelineStageOut:
    max_order = await db.scalar(
        select(func.max(PipelineStage.display_order)).where(PipelineStage.tenant_id == tenant_id)
    )
    stage = PipelineStage(
        tenant_id=tenant_id,
        name=data.name,
        color=data.color,
        display_order=(max_order or 0) + 1,
    )
    db.add(stage)
    await db.commit()
    await db.refresh(stage)
    out = PipelineStageOut.model_validate(stage)
    out.contact_count = 0
    return out


async def update_stage(
    db: AsyncSession, stage: PipelineStage, data: PipelineStageUpdate
) -> PipelineStageOut:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(stage, field, value)
    await db.commit()
    await db.refresh(stage)
    return PipelineStageOut.model_validate(stage)


async def delete_stage(db: AsyncSession, stage: PipelineStage) -> None:
    await db.delete(stage)
    await db.commit()


async def reorder_stages(db: AsyncSession, tenant_id: uuid.UUID, ids: list[uuid.UUID]) -> None:
    for i, stage_id in enumerate(ids):
        await db.execute(
            update(PipelineStage)
            .where(PipelineStage.id == stage_id, PipelineStage.tenant_id == tenant_id)
            .values(display_order=i)
        )
    await db.commit()


async def get_board(db: AsyncSession, tenant_id: uuid.UUID) -> list[PipelineBoardColumn]:
    stages = await list_stages(db, tenant_id)
    if not stages:
        return []

    result = await db.execute(
        select(
            ContactPipelineEntry.stage_id,
            Contact.id,
            Contact.full_name,
            Contact.email,
            Contact.company,
            ContactPipelineEntry.entered_at,
            Company.name.label("company_name"),
        )
        .join(Contact, Contact.id == ContactPipelineEntry.contact_id)
        .outerjoin(Company, Company.id == Contact.company_id)
        .where(ContactPipelineEntry.tenant_id == tenant_id)
        .order_by(ContactPipelineEntry.entered_at)
    )
    contacts_by_stage: dict[uuid.UUID, list[PipelineBoardContact]] = {}
    for row in result.all():
        contacts_by_stage.setdefault(row.stage_id, []).append(
            PipelineBoardContact(
                contact_id=row.id,
                full_name=row.full_name,
                email=row.email,
                company_name=row.company_name or row.company,
                entered_at=row.entered_at,
            )
        )

    return [
        PipelineBoardColumn(stage=s, contacts=contacts_by_stage.get(s.id, []))
        for s in stages
    ]


async def _assign_stage(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_id: uuid.UUID,
    stage_id: uuid.UUID,
) -> None:
    """Write the stage assignment without committing. Caller must commit."""
    existing = await db.scalar(
        select(ContactPipelineEntry).where(ContactPipelineEntry.contact_id == contact_id)
    )
    if existing is None:
        db.add(ContactPipelineEntry(contact_id=contact_id, stage_id=stage_id, tenant_id=tenant_id))
    else:
        existing.stage_id = stage_id


async def move_contact_to_stage(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_id: uuid.UUID,
    stage_id: uuid.UUID,
) -> None:
    exists = await db.scalar(
        select(Contact.id).where(Contact.tenant_id == tenant_id, Contact.id == contact_id)
    )
    if exists is None:
        raise ValueError("Contact not found")

    stage_exists = await db.scalar(
        select(PipelineStage.id).where(PipelineStage.tenant_id == tenant_id, PipelineStage.id == stage_id)
    )
    if stage_exists is None:
        raise ValueError("Stage not found")

    await _assign_stage(db, tenant_id, contact_id, stage_id)
    await db.commit()


async def remove_contact_from_pipeline(
    db: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID
) -> None:
    await db.execute(
        delete(ContactPipelineEntry).where(
            ContactPipelineEntry.contact_id == contact_id,
            ContactPipelineEntry.tenant_id == tenant_id,
        )
    )
    await db.commit()


async def get_contact_stage(
    db: AsyncSession, tenant_id: uuid.UUID, contact_id: uuid.UUID
) -> Optional[PipelineStageOut]:
    entry = await db.scalar(
        select(ContactPipelineEntry).where(
            ContactPipelineEntry.contact_id == contact_id,
            ContactPipelineEntry.tenant_id == tenant_id,
        )
    )
    if not entry:
        return None
    stage = await db.get(PipelineStage, entry.stage_id)
    if not stage:
        return None
    return PipelineStageOut.model_validate(stage)
