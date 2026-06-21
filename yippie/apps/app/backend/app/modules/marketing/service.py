"""MKTG1 — Marketing module DB operations and dispatch logic.

Pure service layer: no HTTP concerns. Email goes out via Resend (core.mailer),
WhatsApp via the Evolution API (chat.whatsapp_service). Open tracking uses a
1x1 pixel pointing at the public /track/open/{token} endpoint; click tracking
reuses the existing campaign-button URL injection in core.email_html.
"""
from __future__ import annotations

import asyncio
import logging
import random
import uuid
from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.core.email_html import render_email_html
from app.modules.contacts.models import Company, Contact, ContactLabel
from app.modules.marketing.models import (
    Campaign,
    CampaignAnalytics,
    CampaignSequence,
    CampaignTemplate,
    ContactUnsubscribe,
)
from app.modules.marketing.schemas import (
    CampaignCreate,
    CampaignSequenceCreate,
    CampaignTemplateCreate,
    CampaignUpdate,
    SegmentFilter,
)

log = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Campaign CRUD
# --------------------------------------------------------------------------- #

async def list_campaigns(db: AsyncSession, tenant_id: uuid.UUID) -> list[Campaign]:
    result = await db.execute(
        select(Campaign)
        .where(Campaign.tenant_id == tenant_id)
        .order_by(Campaign.created_at.desc())
    )
    return list(result.scalars().all())


async def get_campaign(
    db: AsyncSession, tenant_id: uuid.UUID, campaign_id: uuid.UUID
) -> Optional[Campaign]:
    result = await db.execute(
        select(Campaign).where(
            Campaign.id == campaign_id, Campaign.tenant_id == tenant_id
        )
    )
    return result.scalar_one_or_none()


async def create_campaign(
    db: AsyncSession, tenant_id: uuid.UUID, data: CampaignCreate
) -> Campaign:
    campaign = Campaign(
        tenant_id=tenant_id,
        name=data.name,
        subject=data.subject,
        dispatch_channel=data.dispatch_channel,
        status="draft",
    )
    db.add(campaign)
    await db.flush()
    return campaign


async def update_campaign(
    db: AsyncSession, campaign: Campaign, data: CampaignUpdate
) -> Campaign:
    fields = data.model_dump(exclude_unset=True)
    if "segment_filter" in fields and fields["segment_filter"] is not None:
        fields["segment_filter"] = data.segment_filter.model_dump(mode="json")
    for key, value in fields.items():
        setattr(campaign, key, value)
    await db.flush()
    return campaign


async def delete_campaign(db: AsyncSession, campaign: Campaign) -> None:
    await db.delete(campaign)
    await db.flush()


# --------------------------------------------------------------------------- #
# Templates (A/B variants)
# --------------------------------------------------------------------------- #

async def get_campaign_templates(
    db: AsyncSession, campaign_id: uuid.UUID
) -> list[CampaignTemplate]:
    result = await db.execute(
        select(CampaignTemplate).where(CampaignTemplate.campaign_id == campaign_id)
    )
    return list(result.scalars().all())


async def set_campaign_templates(
    db: AsyncSession, campaign: Campaign, data: CampaignTemplateCreate
) -> list[CampaignTemplate]:
    """Upsert template variants. One row per variant ('a'/'b'); a None variant
    is stored as the single default template."""
    existing = {t.variant: t for t in await get_campaign_templates(db, campaign.id)}
    for item in data.templates:
        row = existing.get(item.variant)
        if row is None:
            row = CampaignTemplate(campaign_id=campaign.id, variant=item.variant)
            db.add(row)
        row.raw_html = item.raw_html
        row.raw_css = item.raw_css
    await db.flush()
    return await get_campaign_templates(db, campaign.id)


# --------------------------------------------------------------------------- #
# Sequences (drip steps)
# --------------------------------------------------------------------------- #

async def list_sequences(
    db: AsyncSession, campaign_id: uuid.UUID
) -> list[CampaignSequence]:
    result = await db.execute(
        select(CampaignSequence)
        .where(CampaignSequence.campaign_id == campaign_id)
        .order_by(CampaignSequence.delay_days.asc())
    )
    return list(result.scalars().all())


async def add_sequence(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    campaign_id: uuid.UUID,
    data: CampaignSequenceCreate,
) -> CampaignSequence:
    seq = CampaignSequence(
        tenant_id=tenant_id,
        campaign_id=campaign_id,
        delay_days=data.delay_days,
        subject=data.subject,
        html_body=data.html_body,
    )
    db.add(seq)
    await db.flush()
    return seq


async def delete_sequence(
    db: AsyncSession, tenant_id: uuid.UUID, campaign_id: uuid.UUID, seq_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(CampaignSequence).where(
            CampaignSequence.id == seq_id,
            CampaignSequence.campaign_id == campaign_id,
            CampaignSequence.tenant_id == tenant_id,
        )
    )
    seq = result.scalar_one_or_none()
    if seq is None:
        return False
    await db.delete(seq)
    await db.flush()
    return True


# --------------------------------------------------------------------------- #
# Segment builder
# --------------------------------------------------------------------------- #

async def get_segment_contacts(
    db: AsyncSession, tenant_id: uuid.UUID, spec: SegmentFilter
) -> list[Contact]:
    """Resolve a SegmentFilter into the list of matching, non-deleted contacts."""
    q = select(Contact).where(
        Contact.tenant_id == tenant_id, Contact.deleted_at.is_(None)
    )
    if spec.filter_by == "label" and spec.filter_id:
        q = q.where(Contact.labels.any(ContactLabel.id == spec.filter_id))
    elif spec.filter_by == "company" and spec.filter_id:
        q = q.where(Contact.company_id == spec.filter_id)
    elif spec.filter_by == "pipeline_stage" and spec.filter_id:
        from app.modules.pipeline.models import ContactPipelineEntry

        q = q.where(
            Contact.id.in_(
                select(ContactPipelineEntry.contact_id).where(
                    ContactPipelineEntry.stage_id == spec.filter_id,
                    ContactPipelineEntry.tenant_id == tenant_id,
                )
            )
        )
    # 'all' (or a filter with no id) → every contact in the tenant.
    result = await db.execute(q.order_by(Contact.full_name.asc()))
    return list(result.scalars().all())


async def preview_segment(
    db: AsyncSession, tenant_id: uuid.UUID, spec: SegmentFilter
) -> tuple[int, list[str]]:
    contacts = await get_segment_contacts(db, tenant_id, spec)
    names = [c.full_name for c in contacts[:10]]
    return len(contacts), names


# --------------------------------------------------------------------------- #
# Unsubscribes
# --------------------------------------------------------------------------- #

async def is_unsubscribed(
    db: AsyncSession, contact_id: uuid.UUID, tenant_id: uuid.UUID
) -> bool:
    result = await db.execute(
        select(ContactUnsubscribe.contact_id).where(
            ContactUnsubscribe.contact_id == contact_id,
            ContactUnsubscribe.tenant_id == tenant_id,
        )
    )
    return result.scalar_one_or_none() is not None


async def create_unsubscribe(
    db: AsyncSession, contact_id: uuid.UUID, tenant_id: uuid.UUID
) -> None:
    if await is_unsubscribed(db, contact_id, tenant_id):
        return
    db.add(ContactUnsubscribe(contact_id=contact_id, tenant_id=tenant_id))
    await db.flush()


async def remove_unsubscribe(
    db: AsyncSession, contact_id: uuid.UUID, tenant_id: uuid.UUID
) -> None:
    await db.execute(
        delete(ContactUnsubscribe).where(
            ContactUnsubscribe.contact_id == contact_id,
            ContactUnsubscribe.tenant_id == tenant_id,
        )
    )
    await db.flush()


async def list_unsubscribes(
    db: AsyncSession, tenant_id: uuid.UUID
) -> list[dict]:
    result = await db.execute(
        select(ContactUnsubscribe, Contact)
        .join(Contact, Contact.id == ContactUnsubscribe.contact_id, isouter=True)
        .where(ContactUnsubscribe.tenant_id == tenant_id)
        .order_by(ContactUnsubscribe.unsubscribed_at.desc())
    )
    rows = []
    for unsub, contact in result.all():
        rows.append(
            {
                "contact_id": unsub.contact_id,
                "unsubscribed_at": unsub.unsubscribed_at,
                "contact_name": contact.full_name if contact else None,
                "contact_email": contact.email if contact else None,
            }
        )
    return rows


# --------------------------------------------------------------------------- #
# Analytics — tracking-token state transitions
# --------------------------------------------------------------------------- #

# Ordered so a later event never demotes an earlier one (a click implies an open).
_STATUS_RANK = {"sent": 0, "opened": 1, "clicked": 2, "replied": 3}


async def _row_by_token(
    db: AsyncSession, tracking_token: uuid.UUID
) -> Optional[CampaignAnalytics]:
    result = await db.execute(
        select(CampaignAnalytics).where(
            CampaignAnalytics.tracking_token == tracking_token
        )
    )
    return result.scalar_one_or_none()


def _advance(row: CampaignAnalytics, new_status: str) -> None:
    if _STATUS_RANK.get(new_status, 0) > _STATUS_RANK.get(row.status, 0):
        row.status = new_status
        row.updated_at = datetime.now(timezone.utc)


async def mark_opened(db: AsyncSession, tracking_token: uuid.UUID) -> bool:
    row = await _row_by_token(db, tracking_token)
    if row is None:
        return False
    _advance(row, "opened")
    await db.flush()
    return True


async def mark_clicked(db: AsyncSession, tracking_token: uuid.UUID) -> bool:
    row = await _row_by_token(db, tracking_token)
    if row is None:
        return False
    _advance(row, "clicked")
    await db.flush()
    return True


async def mark_replied(
    db: AsyncSession,
    sender_email: str,
    tenant_id: uuid.UUID,
    classification: Optional[str] = None,
) -> Optional[CampaignAnalytics]:
    """Mark the most-recent analytics row for this sender+tenant as replied."""
    result = await db.execute(
        select(CampaignAnalytics)
        .where(
            CampaignAnalytics.tenant_id == tenant_id,
            func.lower(CampaignAnalytics.recipient_email) == sender_email.lower().strip(),
        )
        .order_by(CampaignAnalytics.updated_at.desc())
        .limit(1)
    )
    row = result.scalar_one_or_none()
    if row is None:
        return None
    _advance(row, "replied")
    if classification:
        row.reply_classification = classification
    await db.flush()
    return row


async def get_campaign_analytics(
    db: AsyncSession, tenant_id: uuid.UUID, campaign_id: uuid.UUID
) -> dict:
    result = await db.execute(
        select(CampaignAnalytics)
        .where(
            CampaignAnalytics.campaign_id == campaign_id,
            CampaignAnalytics.tenant_id == tenant_id,
        )
        .order_by(CampaignAnalytics.recipient_email.asc())
    )
    rows = list(result.scalars().all())

    sent = len(rows)
    opened = sum(1 for r in rows if _STATUS_RANK[r.status] >= _STATUS_RANK["opened"])
    clicked = sum(1 for r in rows if _STATUS_RANK[r.status] >= _STATUS_RANK["clicked"])
    replied = sum(1 for r in rows if r.status == "replied")

    unsub = await db.scalar(
        select(func.count())
        .select_from(ContactUnsubscribe)
        .where(ContactUnsubscribe.tenant_id == tenant_id)
    )

    def _rate(n: int) -> float:
        return round(100.0 * n / sent, 1) if sent else 0.0

    # Per-variant breakdown (only meaningful for A/B campaigns).
    variants: list[dict] = []
    for v in ("a", "b"):
        vr = [r for r in rows if r.variant == v]
        if vr:
            variants.append(
                {
                    "variant": v,
                    "sent": len(vr),
                    "opened": sum(
                        1 for r in vr if _STATUS_RANK[r.status] >= _STATUS_RANK["opened"]
                    ),
                    "clicked": sum(
                        1 for r in vr if _STATUS_RANK[r.status] >= _STATUS_RANK["clicked"]
                    ),
                    "replied": sum(1 for r in vr if r.status == "replied"),
                }
            )

    campaign = await get_campaign(db, tenant_id, campaign_id)
    return {
        "sent": sent,
        "opened": opened,
        "clicked": clicked,
        "replied": replied,
        "unsubscribed": int(unsub or 0),
        "open_rate": _rate(opened),
        "click_rate": _rate(clicked),
        "reply_rate": _rate(replied),
        "ab_winner": campaign.ab_winner if campaign else None,
        "variants": variants,
        "recipients": rows,
    }


# --------------------------------------------------------------------------- #
# Dispatch
# --------------------------------------------------------------------------- #

def _open_pixel(base_url: str, token: uuid.UUID) -> str:
    return (
        f'<img src="{base_url}/api/v1/track/open/{token}" '
        f'width="1" height="1" alt="" style="display:none;border:0;" />'
    )


def _unsubscribe_footer(base_url: str, token: uuid.UUID) -> str:
    href = f"{base_url}/api/v1/track/unsubscribe/{token}"
    return (
        f'<div style="text-align:center;padding:12px 0;font-size:11px;color:#9ca3af;">'
        f'<a href="{href}" style="color:#9ca3af;">Unsubscribe</a></div>'
    )


def _select_variant_html(
    templates: dict[Optional[str], CampaignTemplate], variant: Optional[str]
) -> str:
    tpl = templates.get(variant) or templates.get(None)
    if tpl is None and templates:
        tpl = next(iter(templates.values()))
    return (tpl.raw_html if tpl and tpl.raw_html else "") or ""


async def launch_campaign(
    db: AsyncSession,
    campaign: Campaign,
    *,
    segment_override: Optional[SegmentFilter] = None,
    enable_ab: bool = True,
    sender_email: Optional[str] = None,
) -> dict:
    """Build the recipient list, mint tracking tokens, dispatch, and record analytics.

    For A/B: when two variants exist and enable_ab is True, only the first 50%
    of recipients are sent (split between A and B). The remaining 50% are held
    for the A/B winner job. Without A/B, everyone is sent the available template.
    """
    settings = get_settings()
    base_url = settings.effective_base_url or settings.app_base_url or ""
    tenant_id = campaign.tenant_id

    spec = segment_override or (
        SegmentFilter(**campaign.segment_filter)
        if campaign.segment_filter
        else SegmentFilter(filter_by="all")
    )
    contacts = await get_segment_contacts(db, tenant_id, spec)

    # Skip opted-out contacts.
    recipients: list[Contact] = []
    skipped = 0
    for c in contacts:
        if not c.email:
            continue
        if await is_unsubscribed(db, c.id, tenant_id):
            skipped += 1
            continue
        recipients.append(c)

    templates_list = await get_campaign_templates(db, campaign.id)
    templates = {t.variant: t for t in templates_list}
    has_ab = enable_ab and templates.get("a") is not None and templates.get("b") is not None

    # When A/B, only the first half is dispatched now; remainder held for winner.
    dispatch_set = recipients
    if has_ab:
        half = max(1, len(recipients) // 2)
        dispatch_set = recipients[:half]

    campaign.status = "sending"
    campaign.dispatched_at = datetime.now(timezone.utc)
    await db.flush()

    payloads: list[tuple[Contact, str, str]] = []  # (contact, variant, html)
    for idx, contact in enumerate(dispatch_set):
        token = uuid.uuid4()
        variant: Optional[str] = None
        if has_ab:
            variant = "a" if idx % 2 == 0 else "b"
        body_html = _select_variant_html(templates, variant)

        full_html = render_email_html(
            body_text=campaign.subject,
            prerendered_html=body_html or f"<p>{campaign.subject}</p>",
        )
        full_html += _open_pixel(base_url, token)
        full_html += _unsubscribe_footer(base_url, token)

        db.add(
            CampaignAnalytics(
                tenant_id=tenant_id,
                campaign_id=campaign.id,
                recipient_email=contact.email,
                status="sent",
                tracking_token=token,
                variant=variant,
            )
        )
        payloads.append((contact, full_html, contact.email))

    await db.flush()

    # Actual sending happens after the DB rows exist so a delivery failure
    # never loses the analytics row. Failures are logged, not fatal.
    if campaign.dispatch_channel == "whatsapp":
        await _dispatch_whatsapp(db, campaign, dispatch_set)
    else:
        await _dispatch_email(campaign, payloads, sender_email)

    # If no A/B hold-back, the whole list is out → completed.
    if not has_ab:
        campaign.status = "completed"
    await db.flush()

    return {
        "campaign_id": campaign.id,
        "status": campaign.status,
        "recipients": len(dispatch_set),
        "skipped_unsubscribed": skipped,
    }


async def _dispatch_email(
    campaign: Campaign,
    payloads: list[tuple[Contact, str, str]],
    sender_email: Optional[str],
) -> None:
    from app.core.mailer import send_email

    for _contact, html, to_email in payloads:
        try:
            await send_email(
                to=to_email,
                subject=campaign.subject,
                body=campaign.subject,
                html=html,
                from_email=sender_email,
            )
        except Exception:
            log.exception("Campaign %s: failed to send to %s", campaign.id, to_email)


async def _dispatch_whatsapp(
    db: AsyncSession, campaign: Campaign, contacts: list[Contact]
) -> None:
    """Send the campaign subject as a WhatsApp text with a 5-10s random delay
    per recipient (anti-ban). Instance name is the tenant slug."""
    from app.core.models import Tenant
    from app.modules.chat import whatsapp_service

    tenant = await db.get(Tenant, campaign.tenant_id)
    if tenant is None:
        return
    instance = tenant.slug
    for contact in contacts:
        if not contact.phone:
            continue
        try:
            await whatsapp_service.send_text(instance, contact.phone, campaign.subject)
        except Exception:
            log.exception("Campaign %s: WhatsApp send failed for %s", campaign.id, contact.phone)
        await asyncio.sleep(random.uniform(5, 10))


# --------------------------------------------------------------------------- #
# A/B winner selection
# --------------------------------------------------------------------------- #

async def ab_pick_winner(
    db: AsyncSession, campaign: Campaign
) -> Optional[str]:
    """Pick the variant with the higher open rate, store it, and send the held-
    back 50% the winning template. Returns the winning variant ('a'/'b')."""
    result = await db.execute(
        select(CampaignAnalytics).where(
            CampaignAnalytics.campaign_id == campaign.id,
            CampaignAnalytics.tenant_id == campaign.tenant_id,
        )
    )
    rows = list(result.scalars().all())

    def _open_rate(variant: str) -> float:
        vr = [r for r in rows if r.variant == variant]
        if not vr:
            return 0.0
        opened = sum(
            1 for r in vr if _STATUS_RANK[r.status] >= _STATUS_RANK["opened"]
        )
        return opened / len(vr)

    rate_a, rate_b = _open_rate("a"), _open_rate("b")
    winner = "a" if rate_a >= rate_b else "b"
    campaign.ab_winner = winner
    await db.flush()

    # Send the winning template to recipients who haven't been dispatched yet.
    spec = (
        SegmentFilter(**campaign.segment_filter)
        if campaign.segment_filter
        else SegmentFilter(filter_by="all")
    )
    contacts = await get_segment_contacts(db, campaign.tenant_id, spec)
    already = {
        r.recipient_email.lower()
        for r in rows
    }
    remaining: list[Contact] = []
    for c in contacts:
        if not c.email or c.email.lower() in already:
            continue
        if await is_unsubscribed(db, c.id, campaign.tenant_id):
            continue
        remaining.append(c)

    settings = get_settings()
    base_url = settings.effective_base_url or settings.app_base_url or ""
    templates = {t.variant: t for t in await get_campaign_templates(db, campaign.id)}
    win_html = _select_variant_html(templates, winner)

    payloads: list[tuple[Contact, str, str]] = []
    for contact in remaining:
        token = uuid.uuid4()
        full_html = render_email_html(
            body_text=campaign.subject,
            prerendered_html=win_html or f"<p>{campaign.subject}</p>",
        )
        full_html += _open_pixel(base_url, token)
        full_html += _unsubscribe_footer(base_url, token)
        db.add(
            CampaignAnalytics(
                tenant_id=campaign.tenant_id,
                campaign_id=campaign.id,
                recipient_email=contact.email,
                status="sent",
                tracking_token=token,
                variant=winner,
            )
        )
        payloads.append((contact, full_html, contact.email))

    await db.flush()
    if payloads:
        await _dispatch_email(campaign, payloads, None)

    campaign.status = "completed"
    await db.flush()
    return winner
