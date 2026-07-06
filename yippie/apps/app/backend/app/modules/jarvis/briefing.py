"""[YIP5] Morning briefing builder — a deterministic per user digest.

Plain text on purpose (matches Yip's no markdown style) and zero LLM cost.
Sections are gated by the tenant's enabled modules; returns None when there is
nothing worth saying so the scheduler can skip the user quietly.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.models import Tenant, User, UserReminder
from app.modules.tickets.models import Ticket, TicketStatus

MAX_SUBJECTS = 3


def _short(subject: str, limit: int = 40) -> str:
    return subject if len(subject) <= limit else subject[: limit - 1] + "…"


async def build_briefing(db: AsyncSession, tenant: Tenant, user: User, tz: ZoneInfo) -> str | None:
    enabled = set(tenant.enabled_modules or [])
    now = datetime.now(timezone.utc)
    local_now = now.astimezone(tz)
    day_start = local_now.replace(hour=0, minute=0, second=0, microsecond=0)
    day_end_utc = (day_start + timedelta(days=1)).astimezone(timezone.utc)

    lines: list[str] = []

    if "tickets" in enabled:
        mine_or_unassigned = (Ticket.assigned_to == user.id) | Ticket.assigned_to.is_(None)
        open_states = Ticket.status.in_((TicketStatus.open, TicketStatus.in_progress))
        base = (Ticket.tenant_id == tenant.id, Ticket.deleted_at.is_(None), open_states, mine_or_unassigned)

        breached = (
            await db.execute(
                select(Ticket.subject)
                .where(*base, Ticket.sla_due_at < now)
                .order_by(Ticket.sla_due_at.asc())
            )
        ).scalars().all()
        due_today = (
            await db.execute(
                select(func.count())
                .select_from(Ticket)
                .where(*base, Ticket.sla_due_at >= now, Ticket.sla_due_at < day_end_utc)
            )
        ).scalar() or 0

        if breached:
            examples = ", ".join(_short(s) for s in breached[:MAX_SUBJECTS])
            lines.append(f"Tickets past their SLA: {len(breached)} ({examples}).")
        if due_today:
            lines.append(f"Tickets due today: {due_today}.")

    if "calendar" in enabled:
        from app.modules.calendar import service as calendar_service

        items = await calendar_service.list_calendar_items(
            db, tenant.id, day_start.astimezone(timezone.utc), day_end_utc, None, user.id
        )
        visible = [
            i for i in items
            if getattr(i, "calendar_type", None) != "personal" or getattr(i, "created_by", None) == user.id
        ]
        meetings = [i for i in visible if i.kind == "event"]
        if meetings:
            parts = []
            for m in meetings[:4]:
                when = "all day" if getattr(m, "all_day", False) else m.start_at.astimezone(tz).strftime("%H:%M")
                parts.append(f"{when} {_short(m.title, 30)}")
            more = f" and {len(meetings) - 4} more" if len(meetings) > 4 else ""
            lines.append(f"Today's meetings: {', '.join(parts)}{more}.")

    if "chat" in enabled:
        from app.modules.chat.models import ChatSession

        waiting = (
            await db.execute(
                select(func.count())
                .select_from(ChatSession)
                .where(
                    ChatSession.tenant_id == tenant.id,
                    ChatSession.status.in_(("open", "assigned")),
                    ChatSession.assigned_to.is_(None) | (ChatSession.unread_count > 0),
                )
            )
        ).scalar() or 0
        if waiting:
            lines.append(f"Live chat: {waiting} conversation{'s' if waiting != 1 else ''} waiting.")

    # Inbox is a core module — always on.
    from app.modules.inbox import service as inbox_service

    pending = await inbox_service.count_pending_drafts(db, tenant.id)
    if pending:
        lines.append(f"Inbox: {pending} email{'s' if pending != 1 else ''} waiting for review.")

    overdue = (
        await db.execute(
            select(func.count())
            .select_from(UserReminder)
            .where(
                UserReminder.tenant_id == tenant.id,
                UserReminder.user_id == user.id,
                UserReminder.remind_at < now,
                UserReminder.dismissed_at.is_(None),
            )
        )
    ).scalar() or 0
    if overdue:
        lines.append(f"Follow ups: {overdue} overdue reminder{'s' if overdue != 1 else ''}.")

    if not lines:
        return None

    first_name = (user.full_name or "").split(" ")[0] or "there"
    header = f"Good morning {first_name}. Your briefing for {local_now.strftime('%A %d %B')}:"
    return header + "\n\n" + "\n".join(lines)
