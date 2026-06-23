"""MKTG1 — Marketing module HTTP endpoints (gated per-tenant)."""
from __future__ import annotations

import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import AdminUser, CurrentUser
from app.database import get_db
from app.modules.emailtracking import service as emailtracking_service
from app.modules.emailtracking.schemas import OutboundEmailOut
from app.modules.marketing import service
from app.modules.marketing.schemas import (
    ButtonAnalyticOut,
    CampaignAnalyticsSummary,
    CampaignCreate,
    CampaignLaunchRequest,
    CampaignOut,
    CampaignSequenceCreate,
    CampaignSequenceOut,
    CampaignTemplateCreate,
    CampaignTemplateOut,
    CampaignUpdate,
    ContactUnsubscribeOut,
    LaunchResultOut,
    MarketingStatsOut,
    SegmentFilter,
    SegmentPreviewOut,
    TestSendOut,
)

router = APIRouter(prefix="/marketing", tags=["marketing"])

DB = Annotated[AsyncSession, Depends(get_db)]


async def _require_campaign(db: AsyncSession, tenant_id: uuid.UUID, campaign_id: uuid.UUID):
    campaign = await service.get_campaign(db, tenant_id, campaign_id)
    if campaign is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


# --- Campaigns -------------------------------------------------------------- #

@router.get("/campaigns", response_model=list[CampaignOut])
async def list_campaigns(current_user: CurrentUser, db: DB):
    return await service.list_campaigns(db, current_user.tenant_id)


@router.post("/campaigns", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def create_campaign(body: CampaignCreate, current_user: CurrentUser, db: DB):
    campaign = await service.create_campaign(db, current_user.tenant_id, body)
    await db.commit()
    return campaign


@router.get("/campaigns/{campaign_id}", response_model=CampaignOut)
async def get_campaign(campaign_id: uuid.UUID, current_user: CurrentUser, db: DB):
    return await _require_campaign(db, current_user.tenant_id, campaign_id)


@router.patch("/campaigns/{campaign_id}", response_model=CampaignOut)
async def update_campaign(
    campaign_id: uuid.UUID, body: CampaignUpdate, current_user: CurrentUser, db: DB
):
    campaign = await _require_campaign(db, current_user.tenant_id, campaign_id)
    campaign = await service.update_campaign(db, campaign, body)
    await db.commit()
    return campaign


@router.delete("/campaigns/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_campaign(campaign_id: uuid.UUID, current_user: AdminUser, db: DB):
    campaign = await _require_campaign(db, current_user.tenant_id, campaign_id)
    if campaign.status != "draft":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only draft campaigns can be deleted.",
        )
    await service.delete_campaign(db, campaign)
    await db.commit()


@router.post("/campaigns/{campaign_id}/duplicate", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
async def duplicate_campaign(campaign_id: uuid.UUID, current_user: CurrentUser, db: DB):
    campaign = await _require_campaign(db, current_user.tenant_id, campaign_id)
    new_campaign = await service.duplicate_campaign(db, campaign)
    await db.commit()
    return new_campaign


@router.post("/campaigns/{campaign_id}/test-send", response_model=TestSendOut)
async def test_send_campaign(campaign_id: uuid.UUID, current_user: CurrentUser, db: DB):
    campaign = await _require_campaign(db, current_user.tenant_id, campaign_id)
    result = await service.test_send_campaign(db, campaign, current_user)
    return result


# --- Templates -------------------------------------------------------------- #

@router.get("/campaigns/{campaign_id}/templates", response_model=list[CampaignTemplateOut])
async def get_templates(campaign_id: uuid.UUID, current_user: CurrentUser, db: DB):
    await _require_campaign(db, current_user.tenant_id, campaign_id)
    return await service.get_campaign_templates(db, campaign_id)


@router.post("/campaigns/{campaign_id}/templates", response_model=list[CampaignTemplateOut])
async def set_templates(
    campaign_id: uuid.UUID,
    body: CampaignTemplateCreate,
    current_user: CurrentUser,
    db: DB,
):
    campaign = await _require_campaign(db, current_user.tenant_id, campaign_id)
    templates = await service.set_campaign_templates(db, campaign, body)
    await db.commit()
    return templates


# --- Launch / schedule ------------------------------------------------------ #

@router.post("/campaigns/{campaign_id}/launch", response_model=LaunchResultOut)
async def launch_campaign(
    campaign_id: uuid.UUID,
    current_user: AdminUser,
    db: DB,
    body: CampaignLaunchRequest | None = None,
):
    campaign = await _require_campaign(db, current_user.tenant_id, campaign_id)
    if campaign.status in ("sending", "completed"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Campaign has already been launched.",
        )
    body = body or CampaignLaunchRequest()
    result = await service.launch_campaign(
        db,
        campaign,
        segment_override=body.segment_filter,
        enable_ab=body.enable_ab,
    )
    await db.commit()
    return result


@router.post("/campaigns/{campaign_id}/schedule", response_model=CampaignOut)
async def schedule_campaign(
    campaign_id: uuid.UUID,
    body: CampaignUpdate,
    current_user: CurrentUser,
    db: DB,
):
    campaign = await _require_campaign(db, current_user.tenant_id, campaign_id)
    if body.scheduled_at is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="scheduled_at is required.",
        )
    campaign.scheduled_at = body.scheduled_at
    campaign.status = "scheduled"
    if body.segment_filter is not None:
        campaign.segment_filter = body.segment_filter.model_dump(mode="json")
    await db.commit()
    await db.refresh(campaign)
    return campaign


# --- Analytics -------------------------------------------------------------- #

@router.get("/campaigns/{campaign_id}/analytics", response_model=CampaignAnalyticsSummary)
async def get_analytics(campaign_id: uuid.UUID, current_user: CurrentUser, db: DB):
    await _require_campaign(db, current_user.tenant_id, campaign_id)
    return await service.get_campaign_analytics(db, current_user.tenant_id, campaign_id)


@router.get("/campaigns/{campaign_id}/button-analytics", response_model=list[ButtonAnalyticOut])
async def get_button_analytics(campaign_id: uuid.UUID, current_user: CurrentUser, db: DB):
    await _require_campaign(db, current_user.tenant_id, campaign_id)
    return await service.get_button_analytics(db, current_user.tenant_id, campaign_id)


@router.get("/stats", response_model=MarketingStatsOut)
async def get_marketing_stats(
    current_user: CurrentUser,
    db: DB,
    days: int = Query(default=30, ge=1, le=365),
):
    return await service.get_marketing_stats(db, current_user.tenant_id, days)


# --- Sequences (drip) ------------------------------------------------------- #

@router.get("/campaigns/{campaign_id}/sequences", response_model=list[CampaignSequenceOut])
async def list_sequences(campaign_id: uuid.UUID, current_user: CurrentUser, db: DB):
    await _require_campaign(db, current_user.tenant_id, campaign_id)
    return await service.list_sequences(db, campaign_id)


@router.post(
    "/campaigns/{campaign_id}/sequences",
    response_model=CampaignSequenceOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_sequence(
    campaign_id: uuid.UUID,
    body: CampaignSequenceCreate,
    current_user: CurrentUser,
    db: DB,
):
    await _require_campaign(db, current_user.tenant_id, campaign_id)
    seq = await service.add_sequence(db, current_user.tenant_id, campaign_id, body)
    await db.commit()
    return seq


@router.delete(
    "/campaigns/{campaign_id}/sequences/{seq_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_sequence(
    campaign_id: uuid.UUID,
    seq_id: uuid.UUID,
    current_user: CurrentUser,
    db: DB,
):
    await _require_campaign(db, current_user.tenant_id, campaign_id)
    ok = await service.delete_sequence(db, current_user.tenant_id, campaign_id, seq_id)
    if not ok:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Step not found")
    await db.commit()


# --- Segments --------------------------------------------------------------- #

@router.get("/segments/preview", response_model=SegmentPreviewOut)
async def preview_segment(
    current_user: CurrentUser,
    db: DB,
    filter_by: str = Query("all"),
    filter_id: uuid.UUID | None = Query(None),
):
    spec = SegmentFilter(filter_by=filter_by, filter_id=filter_id)
    count, names = await service.preview_segment(db, current_user.tenant_id, spec)
    return SegmentPreviewOut(count=count, names=names)


# --- Unsubscribes ----------------------------------------------------------- #

@router.get("/unsubscribes", response_model=list[ContactUnsubscribeOut])
async def list_unsubscribes(current_user: CurrentUser, db: DB):
    return await service.list_unsubscribes(db, current_user.tenant_id)


@router.delete("/unsubscribes/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def remove_unsubscribe(contact_id: uuid.UUID, current_user: CurrentUser, db: DB):
    await service.remove_unsubscribe(db, current_user.tenant_id, contact_id)
    await db.commit()


# --- Outbound transactional email tracking ---------------------------------- #
# Folded in from the former standalone ``emailtracking`` module (MODULE-RENAME):
# transactional agent emails tracked via the OutboundEmail model + Resend webhook
# are now surfaced under marketing as ``GET /marketing/outbound``.

@router.get("/outbound", response_model=list[OutboundEmailOut])
async def list_outbound(current_user: CurrentUser, db: DB, limit: int = 200, q: str | None = None):
    return await emailtracking_service.list_outbound(
        db, tenant_id=current_user.tenant_id, limit=limit, search=q
    )
