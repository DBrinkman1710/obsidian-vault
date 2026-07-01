from __future__ import annotations

import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.activity.models import ActivityEvent


async def log_event(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    module: str,
    event_type: str,
    entity_type: str,
    entity_id: Optional[uuid.UUID] = None,
    contact_id: Optional[uuid.UUID] = None,
    actor_id: Optional[uuid.UUID] = None,
    payload: Optional[dict] = None,
) -> ActivityEvent:
    event = ActivityEvent(
        tenant_id=tenant_id,
        contact_id=contact_id,
        actor_id=actor_id,
        module=module,
        event_type=event_type,
        entity_type=entity_type,
        entity_id=entity_id,
        payload=payload,
    )
    db.add(event)
    await db.flush()
    return event


async def list_events(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    contact_id: Optional[uuid.UUID] = None,
    limit: int = 100,
    pipeline_stage_id: Optional[uuid.UUID] = None,
) -> list[dict]:
    from app.core.models import User
    from app.modules.pipeline.models import ContactPipelineEntry

    q = (
        select(ActivityEvent, User.full_name.label("actor_name"))
        .outerjoin(User, ActivityEvent.actor_id == User.id)
        .where(ActivityEvent.tenant_id == tenant_id)
    )
    if contact_id:
        q = q.where(ActivityEvent.contact_id == contact_id)
    if pipeline_stage_id:
        q = q.join(
            ContactPipelineEntry,
            ContactPipelineEntry.contact_id == ActivityEvent.contact_id,
        ).where(
            ContactPipelineEntry.stage_id == pipeline_stage_id,
            ContactPipelineEntry.tenant_id == tenant_id,
        )
    result = await db.execute(q.order_by(ActivityEvent.created_at.desc()).limit(limit))
    events = []
    for row in result.all():
        ev: ActivityEvent = row[0]
        events.append({
            "id": ev.id,
            "tenant_id": ev.tenant_id,
            "contact_id": ev.contact_id,
            "actor_id": ev.actor_id,
            "actor_name": row[1],
            "module": ev.module,
            "event_type": ev.event_type,
            "entity_type": ev.entity_type,
            "entity_id": ev.entity_id,
            "payload": ev.payload,
            "created_at": ev.created_at,
        })
    return events


async def get_activity_stats(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    base = ActivityEvent.tenant_id == tenant_id
    total = await db.scalar(select(func.count()).where(base))
    today = await db.scalar(select(func.count()).where(base, ActivityEvent.created_at >= today_start))
    this_week = await db.scalar(select(func.count()).where(base, ActivityEvent.created_at >= week_start))
    return {"today": today or 0, "this_week": this_week or 0, "total": total or 0}


async def get_kpis(db: AsyncSession, tenant_id: uuid.UUID) -> dict:
    from app.modules.contacts.models import Contact
    from app.modules.emailtracking.models import OutboundEmail
    from app.modules.pipeline.models import ContactPipelineEntry, PipelineStage
    from app.modules.tickets.models import Ticket, TicketStatus

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    # --- Pipeline ---
    avg_days = (
        func.extract("epoch", func.now() - ContactPipelineEntry.entered_at) / 86400.0
    )
    pipeline_q = (
        select(
            PipelineStage.id,
            PipelineStage.name,
            PipelineStage.color,
            func.count(ContactPipelineEntry.contact_id),
            func.avg(avg_days),
        )
        .select_from(PipelineStage)
        .outerjoin(
            ContactPipelineEntry,
            (ContactPipelineEntry.stage_id == PipelineStage.id)
            & (ContactPipelineEntry.tenant_id == tenant_id),
        )
        .where(PipelineStage.tenant_id == tenant_id)
        .group_by(PipelineStage.id, PipelineStage.name, PipelineStage.color, PipelineStage.display_order)
        .order_by(PipelineStage.display_order)
    )
    pipeline_rows = (await db.execute(pipeline_q)).all()
    pipeline = [
        {
            "stage_id": row[0],
            "stage_name": row[1],
            "color": row[2],
            "contact_count": row[3] or 0,
            "avg_days_in_stage": round(float(row[4]), 1) if row[4] is not None else None,
        }
        for row in pipeline_rows
    ]

    # --- Email ---
    email_base = OutboundEmail.tenant_id == tenant_id
    sent_total = await db.scalar(select(func.count()).where(email_base)) or 0
    sent_this_week = (
        await db.scalar(
            select(func.count()).where(email_base, OutboundEmail.created_at >= week_start)
        )
        or 0
    )
    delivered = (
        await db.scalar(
            select(func.count()).where(email_base, OutboundEmail.delivered_at.is_not(None))
        )
        or 0
    )
    opened = (
        await db.scalar(
            select(func.count()).where(email_base, OutboundEmail.opened_at.is_not(None))
        )
        or 0
    )
    bounced = (
        await db.scalar(
            select(func.count()).where(email_base, OutboundEmail.bounced_at.is_not(None))
        )
        or 0
    )
    open_rate = (opened / sent_total) if sent_total else 0.0

    email = {
        "sent_total": sent_total,
        "sent_this_week": sent_this_week,
        "delivered": delivered,
        "opened": opened,
        "open_rate": open_rate,
        "bounced": bounced,
    }

    # --- Tickets ---
    ticket_base = (Ticket.tenant_id == tenant_id) & (Ticket.deleted_at.is_(None))
    open_count = (
        await db.scalar(select(func.count()).where(ticket_base, Ticket.status == TicketStatus.open))
        or 0
    )
    in_progress = (
        await db.scalar(
            select(func.count()).where(ticket_base, Ticket.status == TicketStatus.in_progress)
        )
        or 0
    )
    resolved_this_week = (
        await db.scalar(
            select(func.count()).where(
                ticket_base,
                Ticket.status.in_([TicketStatus.resolved, TicketStatus.closed]),
                Ticket.updated_at >= week_start,
            )
        )
        or 0
    )
    resolution_seconds = await db.scalar(
        select(func.avg(func.extract("epoch", Ticket.resolved_at - Ticket.created_at))).where(
            ticket_base,
            Ticket.status.in_([TicketStatus.resolved, TicketStatus.closed]),
            Ticket.resolved_at.is_not(None),
        )
    )
    avg_resolution_hours = (
        round(float(resolution_seconds) / 3600.0, 1) if resolution_seconds is not None else None
    )

    tickets = {
        "open": open_count,
        "in_progress": in_progress,
        "resolved_this_week": resolved_this_week,
        "avg_resolution_hours": avg_resolution_hours,
    }

    # --- Contacts ---
    contact_base = Contact.tenant_id == tenant_id
    contacts_total = await db.scalar(select(func.count()).where(contact_base)) or 0
    contacts_new_this_week = (
        await db.scalar(
            select(func.count()).where(contact_base, Contact.created_at >= week_start)
        )
        or 0
    )
    contacts = {
        "total": contacts_total,
        "new_this_week": contacts_new_this_week,
    }

    return {
        "pipeline": pipeline,
        "email": email,
        "tickets": tickets,
        "contacts": contacts,
    }


async def get_agent_kpis(db: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    from app.core.models import User
    from app.modules.emailtracking.models import OutboundEmail
    from app.modules.tickets.models import Ticket, TicketStatus

    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_start = today_start - timedelta(days=today_start.weekday())

    users_rows = (
        await db.execute(
            select(User.id, User.full_name)
            .where(User.tenant_id == tenant_id, User.is_active == True)
            .order_by(User.full_name)
        )
    ).all()

    if not users_rows:
        return []

    user_ids = [r[0] for r in users_rows]

    email_rows = (
        await db.execute(
            select(
                OutboundEmail.actor_id,
                func.count().label("emails_sent"),
                func.count(OutboundEmail.opened_at).label("emails_opened"),
            )
            .where(OutboundEmail.tenant_id == tenant_id, OutboundEmail.actor_id.in_(user_ids))
            .group_by(OutboundEmail.actor_id)
        )
    ).all()
    email_map = {r[0]: {"emails_sent": r[1], "emails_opened": r[2]} for r in email_rows}

    ticket_base = (Ticket.tenant_id == tenant_id) & (Ticket.deleted_at.is_(None))
    assigned_rows = (
        await db.execute(
            select(Ticket.assigned_to, func.count().label("cnt"))
            .where(
                ticket_base,
                Ticket.assigned_to.in_(user_ids),
                ~Ticket.status.in_([TicketStatus.resolved, TicketStatus.closed]),
            )
            .group_by(Ticket.assigned_to)
        )
    ).all()
    assigned_map = {r[0]: r[1] for r in assigned_rows}

    resolved_rows = (
        await db.execute(
            select(
                Ticket.assigned_to,
                func.count().label("cnt"),
                func.avg(
                    func.extract("epoch", Ticket.resolved_at - Ticket.created_at) / 3600.0
                ).label("avg_hours"),
            )
            .where(
                ticket_base,
                Ticket.assigned_to.in_(user_ids),
                Ticket.status.in_([TicketStatus.resolved, TicketStatus.closed]),
                Ticket.updated_at >= week_start,
                Ticket.resolved_at.is_not(None),
            )
            .group_by(Ticket.assigned_to)
        )
    ).all()
    resolved_map = {r[0]: {"cnt": r[1], "avg_hours": r[2]} for r in resolved_rows}

    result = []
    for user_id, full_name in users_rows:
        em = email_map.get(user_id, {"emails_sent": 0, "emails_opened": 0})
        res = resolved_map.get(user_id, {"cnt": 0, "avg_hours": None})
        result.append(
            {
                "agent_id": str(user_id),
                "agent_name": full_name,
                "emails_sent": em["emails_sent"],
                "emails_opened": em["emails_opened"],
                "tickets_assigned": assigned_map.get(user_id, 0),
                "tickets_resolved_this_week": res["cnt"],
                "avg_resolution_hours": (
                    round(float(res["avg_hours"]), 1) if res["avg_hours"] is not None else None
                ),
            }
        )
    return result
