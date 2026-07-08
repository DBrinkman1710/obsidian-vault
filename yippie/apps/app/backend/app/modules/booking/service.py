from __future__ import annotations

import asyncio
import html as _html
import logging
import os
import uuid
from collections import defaultdict
from datetime import date as date_cls, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from typing import Optional

from sqlalchemy import func as sa_func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.email_html import render_email_html
from app.core.mailer import is_valid_email, send_email
from app.core.models import Tenant, User, UserRole
from app.modules.booking.models import (
    BookingToken,
    CalendarSettings,
    WorkerAvailability,
    WorkerAvailabilityException,
)
from app.modules.booking.schemas import (
    AvailableSlot,
    BookingTokenCreate,
    CalendarSettingsUpdate,
    SlotProposal,
)
from app.modules.calendar.models import CalendarEvent
from app.modules.contacts.models import Contact

logger = logging.getLogger(__name__)

CLIENT_BASE_URL = os.environ.get("CLIENT_BASE_URL", "https://sandbox.getyippie.com")

_WEEKDAYS = ("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday")
_MONTHS = (
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
)


def _format_slot(start: datetime, end: datetime) -> str:
    """e.g. 'Monday 16 June 2026, 14:00–14:30'."""
    day = f"{_WEEKDAYS[start.weekday()]} {start.day} {_MONTHS[start.month - 1]} {start.year}"
    return f"{day}, {start:%H:%M}–{end:%H:%M}"


def _now() -> datetime:
    return datetime.now(timezone.utc)


# --------------------------------------------------------------------------- #
# Settings
# --------------------------------------------------------------------------- #
async def get_or_create_settings(db: AsyncSession, tenant_id: uuid.UUID) -> CalendarSettings:
    settings = await db.scalar(
        select(CalendarSettings).where(CalendarSettings.tenant_id == tenant_id)
    )
    if settings is None:
        settings = CalendarSettings(tenant_id=tenant_id)
        db.add(settings)
        await db.commit()
        await db.refresh(settings)
    return settings


async def update_settings(
    db: AsyncSession, tenant_id: uuid.UUID, data: CalendarSettingsUpdate
) -> CalendarSettings:
    settings = await get_or_create_settings(db, tenant_id)
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(settings, field, value)
    await db.commit()
    await db.refresh(settings)
    return settings


# --------------------------------------------------------------------------- #
# Worker availability (per-user schedules)
# --------------------------------------------------------------------------- #
async def get_or_create_worker_availability(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID
) -> WorkerAvailability:
    row = await db.scalar(
        select(WorkerAvailability).where(
            WorkerAvailability.tenant_id == tenant_id,
            WorkerAvailability.user_id == user_id,
        )
    )
    if row is None:
        row = WorkerAvailability(tenant_id=tenant_id, user_id=user_id, weekly_slots={})
        db.add(row)
        await db.commit()
        await db.refresh(row)
    return row


async def update_worker_availability(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID, data
) -> WorkerAvailability:
    row = await get_or_create_worker_availability(db, tenant_id, user_id)
    payload = data.model_dump(exclude_unset=True)
    if "weekly_slots" in payload and payload["weekly_slots"] is not None:
        # Normalise WeeklySlotEntry objects / models to plain JSON-able dicts.
        raw = payload["weekly_slots"]
        row.weekly_slots = {
            str(k): [e if isinstance(e, dict) else e.model_dump() for e in (v or [])]
            for k, v in raw.items()
        }
    if "timezone" in payload:
        row.timezone = payload["timezone"] or None
    if "is_active" in payload and payload["is_active"] is not None:
        row.is_active = payload["is_active"]
    await db.commit()
    await db.refresh(row)
    return row


async def list_workers(db: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    """Admin overview: every worker-role user plus their availability summary."""
    result = await db.execute(
        select(User)
        .where(User.tenant_id == tenant_id, User.role == UserRole.worker)
        .order_by(User.created_at)
    )
    users = list(result.scalars().all())
    if not users:
        return []
    avail_rows = await db.execute(
        select(WorkerAvailability).where(
            WorkerAvailability.tenant_id == tenant_id,
            WorkerAvailability.user_id.in_([u.id for u in users]),
        )
    )
    by_user = {a.user_id: a for a in avail_rows.scalars().all()}
    out = []
    for u in users:
        a = by_user.get(u.id)
        slot_count = 0
        if a and isinstance(a.weekly_slots, dict):
            slot_count = sum(len(v or []) for v in a.weekly_slots.values())
        out.append(
            {
                "user_id": u.id,
                "full_name": u.full_name,
                "email": u.email,
                "is_active_user": u.is_active,
                "availability_active": bool(a.is_active) if a else False,
                "slot_count": slot_count,
                "timezone": (a.timezone if a else None),
            }
        )
    return out


# --------------------------------------------------------------------------- #
# Availability
# --------------------------------------------------------------------------- #
def _resolve_tz(tz_name: Optional[str]) -> ZoneInfo:
    try:
        return ZoneInfo(tz_name or "Europe/Amsterdam")
    except ZoneInfoNotFoundError:
        return ZoneInfo("Europe/Amsterdam")


def _parse_slot_entry(
    entry: dict, day: date_cls, tz: ZoneInfo, now: datetime
) -> Optional[tuple[datetime, datetime]]:
    """Turn one {time, end_time} weekly-slot dict into a UTC (start, end) pair.

    Returns None for malformed entries or slots already in the past.
    """
    raw_time = entry.get("time", "")
    raw_end_time = entry.get("end_time")
    try:
        h, m = (int(x) for x in raw_time.split(":"))
    except (ValueError, AttributeError):
        return None
    slot_start = datetime.combine(day, time(hour=h, minute=m), tzinfo=tz).astimezone(timezone.utc)
    if raw_end_time:
        try:
            eh, em = (int(x) for x in raw_end_time.split(":"))
            slot_end = datetime.combine(day, time(hour=eh, minute=em), tzinfo=tz).astimezone(timezone.utc)
            if slot_end <= slot_start:
                slot_end = slot_start + timedelta(minutes=30)
        except (ValueError, AttributeError):
            slot_end = slot_start + timedelta(minutes=30)
    else:
        slot_end = slot_start + timedelta(minutes=30)
    if slot_start <= now:
        return None
    return (slot_start, slot_end)


def _expand_availability(
    weekly_map: dict,
    exceptions: dict[date_cls, Optional[list]],
    tz: ZoneInfo,
    today: date_cls,
    min_notice: int,
    days_ahead: int,
    now: datetime,
) -> list[tuple[datetime, datetime]]:
    """Expand a worker's recurring weekly_slots (plus one-off date exceptions)
    into concrete UTC (start, end) tuples across the booking window.

    An exception for a date replaces that day's recurring entries entirely; an
    empty exception list means the worker is off that day.
    """
    out: list[tuple[datetime, datetime]] = []
    weekly_map = weekly_map if isinstance(weekly_map, dict) else {}
    for offset in range(min_notice + 1, days_ahead + 1):
        day = today + timedelta(days=offset)
        if day in exceptions:
            entries = exceptions[day] or []  # explicit override (empty = off)
        else:
            if day.weekday() >= 5:
                continue  # skip weekends unless explicitly opened via exception
            entries = weekly_map.get(str(day.weekday())) or []
        for entry in entries:
            parsed = _parse_slot_entry(entry, day, tz, now)
            if parsed is not None:
                out.append(parsed)
    return out


async def _active_worker_rows(
    db: AsyncSession, tenant_id: uuid.UUID
) -> list[WorkerAvailability]:
    """Active WorkerAvailability rows whose owning user is also active."""
    result = await db.execute(
        select(WorkerAvailability)
        .join(User, User.id == WorkerAvailability.user_id)
        .where(
            WorkerAvailability.tenant_id == tenant_id,
            WorkerAvailability.is_active.is_(True),
            User.is_active.is_(True),
        )
    )
    return list(result.scalars().all())


async def _has_active_workers(db: AsyncSession, tenant_id: uuid.UUID) -> bool:
    count = await db.scalar(
        select(sa_func.count(WorkerAvailability.id))
        .join(User, User.id == WorkerAvailability.user_id)
        .where(
            WorkerAvailability.tenant_id == tenant_id,
            WorkerAvailability.is_active.is_(True),
            User.is_active.is_(True),
        )
    )
    return bool(count)


async def _worker_exceptions(
    db: AsyncSession, tenant_id: uuid.UUID, worker_ids: list[uuid.UUID], today: date_cls
) -> dict[uuid.UUID, dict[date_cls, Optional[list]]]:
    if not worker_ids:
        return {}
    rows = await db.execute(
        select(WorkerAvailabilityException).where(
            WorkerAvailabilityException.tenant_id == tenant_id,
            WorkerAvailabilityException.user_id.in_(worker_ids),
            WorkerAvailabilityException.date >= today,
        )
    )
    by_worker: dict[uuid.UUID, dict[date_cls, Optional[list]]] = defaultdict(dict)
    for exc in rows.scalars().all():
        by_worker[exc.user_id][exc.date] = exc.slots
    return by_worker


async def _worker_available_slots(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    settings: CalendarSettings,
    days_ahead: int,
    worker_rows: list[WorkerAvailability],
) -> list[AvailableSlot]:
    """Aggregate per-worker availability into public slots.

    Capacity per slot = number of workers who declared it and are free, minus
    pooled bookings already consuming the slot. A worker is busy at a slot when
    an auto-assigned event or their synced external calendar overlaps it.
    """
    now = _now()
    today = now.date()
    min_notice = max(0, getattr(settings, "min_notice_days", 0))
    worker_ids = [w.user_id for w in worker_rows]
    exceptions = await _worker_exceptions(db, tenant_id, worker_ids, today)

    # slot key -> set of worker ids who declared it
    slot_workers: dict[tuple[datetime, datetime], set[uuid.UUID]] = defaultdict(set)
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None
    for w in worker_rows:
        tz = _resolve_tz(w.timezone or getattr(settings, "timezone", None))
        expanded = _expand_availability(
            w.weekly_slots, exceptions.get(w.user_id, {}), tz, today, min_notice, days_ahead, now
        )
        for slot_start, slot_end in expanded:
            slot_workers[(slot_start, slot_end)].add(w.user_id)
            if window_start is None or slot_start < window_start:
                window_start = slot_start
            if window_end is None or slot_end > window_end:
                window_end = slot_end

    if not slot_workers:
        return []

    # Busy time: calendar events (auto-assigned to a worker, or pooled bookings
    # consuming the slot) and each worker's external calendar events.
    ev_result = await db.execute(
        select(
            CalendarEvent.start_at,
            CalendarEvent.end_at,
            CalendarEvent.assigned_worker_id,
            CalendarEvent.contact_id,
        ).where(
            CalendarEvent.tenant_id == tenant_id,
            CalendarEvent.start_at < window_end,
            CalendarEvent.end_at > window_start,
        )
    )
    events = [
        (r.start_at, r.end_at, r.assigned_worker_id, r.contact_id)
        for r in ev_result.all()
        if r.end_at is not None
    ]

    from app.modules.external_calendar.models import ExternalCalendarEvent
    ext_result = await db.execute(
        select(
            ExternalCalendarEvent.user_id,
            ExternalCalendarEvent.start_at,
            ExternalCalendarEvent.end_at,
        ).where(
            ExternalCalendarEvent.tenant_id == tenant_id,
            ExternalCalendarEvent.user_id.in_(worker_ids),
            ExternalCalendarEvent.start_at < window_end,
            ExternalCalendarEvent.end_at > window_start,
        )
    )
    ext_events = [
        (r.user_id, r.start_at, r.end_at) for r in ext_result.all() if r.end_at is not None
    ]

    out: list[AvailableSlot] = []
    for slot_start, slot_end in sorted(slot_workers.keys()):
        declared = slot_workers[(slot_start, slot_end)]
        busy: set[uuid.UUID] = set()
        pooled_consumed = 0
        for ev_start, ev_end, awid, cid in events:
            if ev_start < slot_end and ev_end > slot_start:
                if awid is not None:
                    if awid in declared:
                        busy.add(awid)
                elif cid is not None:
                    pooled_consumed += 1  # a pooled booking takes one pool unit
        for uid, ev_start, ev_end in ext_events:
            if uid in declared and ev_start < slot_end and ev_end > slot_start:
                busy.add(uid)
        capacity_free = max(0, len(declared - busy) - pooled_consumed)
        out.append(AvailableSlot(start=slot_start, end=slot_end, available=capacity_free > 0))
    return out


async def get_available_slots(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    settings: CalendarSettings,
    days_ahead: int,
    agent_user_id: Optional[uuid.UUID] = None,
) -> list[AvailableSlot]:
    """Generate open/closed slots for the next ``days_ahead`` weekdays.

    When any contract workers have declared availability, slots come from the
    union of those workers' schedules (capacity = number of free workers). When
    no workers are configured the tenant-wide schedule is used instead:
    weekly_slots JSONB (keyed "0"–"6" Mon–Sun) when use_weekly_slots is True,
    else the legacy work_start_hour/work_end_hour/slot_minutes model.

    Only availability (a boolean) is exposed — never event details.
    """
    # Worker-driven availability takes precedence on every booking surface when
    # any worker has opted in. agent_user_id only matters for the legacy
    # single-calendar path below (its external-calendar filtering); in worker
    # mode each worker's external calendar is handled inside the aggregation.
    worker_rows = await _active_worker_rows(db, tenant_id)
    if worker_rows:
        return await _worker_available_slots(
            db, tenant_id, settings, days_ahead, worker_rows
        )

    now = _now()
    today = now.date()

    # Build the candidate slot list first, then bulk-check overlap against events.
    # Each entry is (slot_start, slot_end, capacity) where capacity is the max
    # bookings per slot (weekly mode) or unlimited (legacy mode uses capacity=0).
    slots: list[tuple[datetime, datetime, int]] = []
    window_start: Optional[datetime] = None
    window_end: Optional[datetime] = None

    tz_name = getattr(settings, "timezone", None) or "Europe/Amsterdam"
    try:
        tz = ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        tz = ZoneInfo("Europe/Amsterdam")

    use_weekly = bool(getattr(settings, "use_weekly_slots", False))
    weekly_slots_map: dict = {}
    if use_weekly and settings.weekly_slots:
        # Normalise: the JSONB comes back as a list of dicts keyed by day index,
        # or as a dict keyed by string day numbers.
        raw = settings.weekly_slots
        if isinstance(raw, dict):
            weekly_slots_map = raw
        # (list form not expected, but guard anyway)

    min_notice = max(0, getattr(settings, "min_notice_days", 0))

    if use_weekly and weekly_slots_map:
        # Weekly schedule mode
        for offset in range(min_notice + 1, days_ahead + 1):
            day = today + timedelta(days=offset)
            # Skip weekends (Saturday=5, Sunday=6)
            if day.weekday() >= 5:
                continue
            day_key = str(day.weekday())  # "0" = Monday … "6" = Sunday
            day_entries = weekly_slots_map.get(day_key) or []
            for entry in day_entries:
                raw_time = entry.get("time", "")
                raw_end_time = entry.get("end_time")
                capacity = int(entry.get("capacity", 1))
                try:
                    h, m = (int(x) for x in raw_time.split(":"))
                except (ValueError, AttributeError):
                    continue  # skip malformed entries
                slot_start = datetime.combine(day, time(hour=h, minute=m), tzinfo=tz).astimezone(timezone.utc)
                if raw_end_time:
                    try:
                        eh, em = (int(x) for x in raw_end_time.split(":"))
                        slot_end = datetime.combine(day, time(hour=eh, minute=em), tzinfo=tz).astimezone(timezone.utc)
                        if slot_end <= slot_start:
                            slot_end = slot_start + timedelta(minutes=30)
                    except (ValueError, AttributeError):
                        slot_end = slot_start + timedelta(minutes=30)
                else:
                    slot_end = slot_start + timedelta(minutes=30)
                if slot_start <= now:
                    continue  # skip past slots
                slots.append((slot_start, slot_end, capacity))
                if window_start is None or slot_start < window_start:
                    window_start = slot_start
                if window_end is None or slot_end > window_end:
                    window_end = slot_end
    else:
        # Legacy uniform-hours mode
        step = timedelta(minutes=settings.slot_minutes)
        for offset in range(min_notice + 1, days_ahead + 1):
            day = today + timedelta(days=offset)
            if day.weekday() >= 5:
                continue
            cursor = datetime.combine(day, time(hour=settings.work_start_hour), tzinfo=tz).astimezone(timezone.utc)
            day_end = datetime.combine(day, time(hour=settings.work_end_hour), tzinfo=tz).astimezone(timezone.utc)
            while cursor + step <= day_end:
                slot_start = cursor
                slot_end = cursor + step
                cursor = slot_end
                if slot_start <= now:
                    continue  # skip past slots
                slots.append((slot_start, slot_end, 0))  # 0 = unlimited
                if window_start is None or slot_start < window_start:
                    window_start = slot_start
                if window_end is None or slot_end > window_end:
                    window_end = slot_end

    if not slots:
        return []

    # Fetch events overlapping the whole window, then test each slot in memory.
    result = await db.execute(
        select(CalendarEvent.start_at, CalendarEvent.end_at).where(
            CalendarEvent.tenant_id == tenant_id,
            CalendarEvent.start_at < window_end,
            CalendarEvent.end_at > window_start,
        )
    )
    events = [(r.start_at, r.end_at) for r in result.all() if r.end_at is not None]

    # Also block slots that overlap with the agent's external calendar events (Apple/Outlook).
    if agent_user_id is not None:
        from app.modules.external_calendar.models import ExternalCalendarEvent
        ext_result = await db.execute(
            select(ExternalCalendarEvent.start_at, ExternalCalendarEvent.end_at).where(
                ExternalCalendarEvent.tenant_id == tenant_id,
                ExternalCalendarEvent.user_id == agent_user_id,
                ExternalCalendarEvent.start_at < window_end,
                ExternalCalendarEvent.end_at > window_start,
            )
        )
        events.extend(
            (r.start_at, r.end_at) for r in ext_result.all() if r.end_at is not None
        )

    out: list[AvailableSlot] = []
    for slot_start, slot_end, capacity in slots:
        overlap = any(ev_start < slot_end and ev_end > slot_start for ev_start, ev_end in events)
        if overlap:
            out.append(AvailableSlot(start=slot_start, end=slot_end, available=False))
        elif capacity > 0:
            # Weekly mode: count how many existing events start on this same day
            # (capacity = max bookings per slot/day; we count per slot here)
            booked_count = sum(
                1 for ev_start, ev_end in events
                if ev_start.date() == slot_start.date()
            )
            out.append(AvailableSlot(start=slot_start, end=slot_end, available=booked_count < capacity))
        else:
            out.append(AvailableSlot(start=slot_start, end=slot_end, available=True))
    return out


# --------------------------------------------------------------------------- #
# Worker assignment at confirm time
# --------------------------------------------------------------------------- #
async def resolve_slot_workers(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    slot_start: datetime,
    slot_end: datetime,
) -> Optional[tuple[list[User], int]]:
    """For a specific slot, return (free_workers, pooled_consumed).

    ``free_workers`` are active workers who declared the slot and are not busy
    (no overlapping auto-assigned event or external calendar event).
    ``pooled_consumed`` counts pooled bookings already taking the slot.

    Returns None when the tenant has no active workers (caller falls back to its
    legacy single-event conflict behaviour). Callers should already hold the
    slot advisory lock so the read is race-safe.
    """
    now = _now()
    today = now.date()
    worker_rows = await _active_worker_rows(db, tenant_id)
    if not worker_rows:
        return None

    settings = await get_or_create_settings(db, tenant_id)
    min_notice = max(0, getattr(settings, "min_notice_days", 0))
    days_ahead = max((slot_start.date() - today).days + 1, 1)
    worker_ids = [w.user_id for w in worker_rows]
    exceptions = await _worker_exceptions(db, tenant_id, worker_ids, today)

    declared: set[uuid.UUID] = set()
    for w in worker_rows:
        tz = _resolve_tz(w.timezone or getattr(settings, "timezone", None))
        expanded = _expand_availability(
            w.weekly_slots, exceptions.get(w.user_id, {}), tz, today, min_notice, days_ahead, now
        )
        if (slot_start, slot_end) in expanded:
            declared.add(w.user_id)

    # Busy workers: auto-assigned events overlapping the slot.
    busy: set[uuid.UUID] = set()
    pooled_consumed = 0
    ev_result = await db.execute(
        select(
            CalendarEvent.assigned_worker_id, CalendarEvent.contact_id
        ).where(
            CalendarEvent.tenant_id == tenant_id,
            CalendarEvent.start_at < slot_end,
            CalendarEvent.end_at > slot_start,
        )
    )
    for awid, cid in ev_result.all():
        if awid is not None:
            if awid in declared:
                busy.add(awid)
        elif cid is not None:
            pooled_consumed += 1

    if declared:
        from app.modules.external_calendar.models import ExternalCalendarEvent
        ext_result = await db.execute(
            select(ExternalCalendarEvent.user_id).where(
                ExternalCalendarEvent.tenant_id == tenant_id,
                ExternalCalendarEvent.user_id.in_(declared),
                ExternalCalendarEvent.start_at < slot_end,
                ExternalCalendarEvent.end_at > slot_start,
            )
        )
        busy.update(r.user_id for r in ext_result.all())

    free_ids = declared - busy
    free_users: list[User] = []
    if free_ids:
        rows = await db.execute(select(User).where(User.id.in_(free_ids)))
        free_users = list(rows.scalars().all())
    return (free_users, pooled_consumed)


async def resolve_booking_assignment(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    settings: CalendarSettings,
    slot_start: datetime,
    slot_end: datetime,
) -> tuple[bool, Optional[uuid.UUID], Optional[User]]:
    """Enforce worker capacity for a slot and choose an assignment.

    Returns ``(used_workers, assigned_worker_id, assigned_worker)``. When the
    tenant has no active workers, returns ``(False, None, None)`` and the caller
    keeps its legacy single-event conflict behaviour. Raises ValueError when the
    slot is no longer bookable. The caller must already hold the slot advisory
    lock.
    """
    resolved = await resolve_slot_workers(db, tenant_id, slot_start, slot_end)
    if resolved is None:
        return (False, None, None)
    free_users, pooled_consumed = resolved
    mode = getattr(settings, "assignment_mode", "pooled") or "pooled"
    unavailable = "That time is no longer available. Please pick another slot."
    # In both modes the slot is bookable only while free workers outnumber the
    # bookings already consuming it (pooled bookings aren't tied to a worker).
    if len(free_users) - pooled_consumed <= 0:
        raise ValueError(unavailable)
    if mode == "auto_assign":
        return (True, free_users[0].id, free_users[0])
    return (True, None, None)


# --------------------------------------------------------------------------- #
# Token creation
# --------------------------------------------------------------------------- #
async def create_booking_token(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    created_by_id: uuid.UUID,
    data: BookingTokenCreate,
) -> BookingToken:
    contact = await db.scalar(
        select(Contact).where(Contact.id == data.contact_id, Contact.tenant_id == tenant_id)
    )
    if contact is None:
        raise ValueError("contact_id does not belong to this tenant")

    settings = await get_or_create_settings(db, tenant_id)

    proposed = (
        [{"start": s.start.isoformat(), "end": s.end.isoformat()} for s in data.proposed_slots]
        if data.proposed_slots
        else None
    )

    token = BookingToken(
        tenant_id=tenant_id,
        contact_id=data.contact_id,
        created_by=created_by_id,
        mode=data.mode,
        proposed_slots=proposed,
        message=data.message,
        expires_at=_now() + timedelta(days=settings.booking_expiry_days),
        stage_id_override=data.stage_id_override,
        from_email=data.from_email or None,
    )
    db.add(token)
    await db.commit()
    await db.refresh(token)

    agent = await db.get(User, created_by_id)
    tenant = await db.get(Tenant, tenant_id)
    asyncio.create_task(_send_booking_invitation(token, contact, tenant, agent))
    return token


# --------------------------------------------------------------------------- #
# Listing / revoke
# --------------------------------------------------------------------------- #
def token_status(token: BookingToken) -> str:
    if token.booked_at is not None:
        return "booked"
    if getattr(token, "status_override", None) == "counter_proposed":
        return "counter_proposed"
    expires = token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= _now():
        return "expired"
    return "pending"


async def list_tokens(db: AsyncSession, tenant_id: uuid.UUID) -> list[dict]:
    result = await db.execute(
        select(BookingToken)
        .where(BookingToken.tenant_id == tenant_id)
        .order_by(BookingToken.created_at.desc())
    )
    tokens = list(result.scalars().all())

    contact_ids = {t.contact_id for t in tokens}
    user_ids = {t.created_by for t in tokens}
    contact_names: dict[uuid.UUID, str] = {}
    user_names: dict[uuid.UUID, str] = {}
    if contact_ids:
        rows = await db.execute(
            select(Contact.id, Contact.full_name).where(Contact.id.in_(contact_ids))
        )
        contact_names = {r.id: r.full_name for r in rows}
    if user_ids:
        rows = await db.execute(select(User.id, User.full_name).where(User.id.in_(user_ids)))
        user_names = {r.id: r.full_name for r in rows}

    out = []
    for t in tokens:
        out.append(
            {
                "id": t.id,
                "contact_id": t.contact_id,
                "contact_name": contact_names.get(t.contact_id),
                "created_by": t.created_by,
                "created_by_name": user_names.get(t.created_by),
                "mode": t.mode,
                "proposed_slots": t.proposed_slots,
                "message": t.message,
                "expires_at": t.expires_at,
                "booked_at": t.booked_at,
                "event_id": t.event_id,
                "customer_proposed_slots": t.customer_proposed_slots,
                "created_at": t.created_at,
                "status": token_status(t),
            }
        )
    return out


async def revoke_token(db: AsyncSession, tenant_id: uuid.UUID, token_id: uuid.UUID) -> bool:
    token = await db.scalar(
        select(BookingToken).where(
            BookingToken.id == token_id, BookingToken.tenant_id == tenant_id
        )
    )
    if token is None:
        return False
    token.expires_at = _now()
    await db.commit()
    return True


# --------------------------------------------------------------------------- #
# Public: fetch + confirm
# --------------------------------------------------------------------------- #
async def get_token(db: AsyncSession, token_id: uuid.UUID) -> Optional[BookingToken]:
    return await db.scalar(select(BookingToken).where(BookingToken.id == token_id))


async def confirm_booking(
    db: AsyncSession,
    token: BookingToken,
    slot_start: datetime,
    slot_end: datetime,
) -> CalendarEvent:
    if slot_start.tzinfo is None:
        slot_start = slot_start.replace(tzinfo=timezone.utc)
    if slot_end.tzinfo is None:
        slot_end = slot_end.replace(tzinfo=timezone.utc)

    # Row-lock the token for the rest of this transaction so two concurrent
    # confirmations of the same link can't both pass the "already used" check
    # and double-book the slot.
    token = await db.scalar(
        select(BookingToken).where(BookingToken.id == token.id).with_for_update()
    )
    if token is None:
        raise ValueError("This booking link has expired or has already been used.")

    expires = token.expires_at
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if expires <= _now():
        raise ValueError("This booking link has expired.")
    if token.booked_at is not None:
        raise ValueError("This booking link has already been used.")
    if slot_end <= slot_start:
        raise ValueError("Invalid time slot.")

    settings = await get_or_create_settings(db, token.tenant_id)
    assigned_worker_id: Optional[uuid.UUID] = None
    assigned_worker: Optional[User] = None
    use_workers = await _has_active_workers(db, token.tenant_id)

    if use_workers:
        # Serialise concurrent confirmations of the same slot (across all links)
        # so worker capacity can't be oversubscribed. Released at commit/rollback.
        await db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:tenant), hashtext(:slot))"),
            {"tenant": str(token.tenant_id), "slot": slot_start.isoformat()},
        )
        _used, assigned_worker_id, assigned_worker = await resolve_booking_assignment(
            db, token.tenant_id, settings, slot_start, slot_end
        )
    else:
        # Legacy single-calendar behaviour. Serialise concurrent confirmations
        # for this agent's calendar — the token row lock above only guards THIS
        # link; two different tokens for the same slot could still race here.
        await db.execute(
            text("SELECT pg_advisory_xact_lock(hashtext(:tenant), hashtext(:agent))"),
            {"tenant": str(token.tenant_id), "agent": str(token.created_by)},
        )

        # Re-check availability against current events (race-safe at confirm time).
        conflict = await db.scalar(
            select(CalendarEvent.id).where(
                CalendarEvent.tenant_id == token.tenant_id,
                CalendarEvent.start_at < slot_end,
                CalendarEvent.end_at > slot_start,
            )
        )
        if conflict is not None:
            raise ValueError("That time is no longer available. Please pick another slot.")

        # Also check external calendar events for the agent.
        from app.modules.external_calendar.models import ExternalCalendarEvent
        ext_conflict = await db.scalar(
            select(ExternalCalendarEvent.id).where(
                ExternalCalendarEvent.tenant_id == token.tenant_id,
                ExternalCalendarEvent.user_id == token.created_by,
                ExternalCalendarEvent.start_at < slot_end,
                ExternalCalendarEvent.end_at > slot_start,
            )
        )
        if ext_conflict is not None:
            raise ValueError("That time is no longer available. Please pick another slot.")

    contact = await db.get(Contact, token.contact_id)
    if contact is None:
        raise ValueError("Contact not found.")

    event = CalendarEvent(
        tenant_id=token.tenant_id,
        title=f"Meeting with {contact.full_name}",
        start_at=slot_start,
        end_at=slot_end,
        contact_id=token.contact_id,
        created_by=token.created_by,
        assigned_worker_id=assigned_worker_id,
    )
    db.add(event)
    await db.flush()

    token.booked_at = _now()
    token.event_id = event.id
    token.manage_token = uuid.uuid4()

    # Move contact to the configured post-booking pipeline stage, if any.
    # Per-send override (stage_id_override) takes precedence over the global setting.
    settings = await db.scalar(
        select(CalendarSettings).where(CalendarSettings.tenant_id == token.tenant_id)
    )
    effective_stage_id = token.stage_id_override or (
        settings.post_booking_stage_id if settings is not None else None
    )
    if effective_stage_id is not None:
        from app.modules.pipeline.service import _assign_stage

        await _assign_stage(
            db, token.tenant_id, token.contact_id, effective_stage_id
        )

    await db.commit()
    await db.refresh(event)

    tenant = await db.get(Tenant, token.tenant_id)
    agent = await db.get(User, token.created_by)
    asyncio.create_task(_notify_customer_confirmed(event, contact, tenant, token))
    asyncio.create_task(_notify_agent_confirmed(event, contact, agent))
    # In auto-assign mode also tell the worker who got the job.
    if assigned_worker is not None and assigned_worker.id != token.created_by:
        asyncio.create_task(_notify_agent_confirmed(event, contact, assigned_worker))
    return event


# --------------------------------------------------------------------------- #
# Emails — each opens its own session and never raises.
# --------------------------------------------------------------------------- #
async def _send_booking_invitation(
    token: BookingToken, contact: Contact, tenant: Optional[Tenant], agent: Optional[User]
) -> None:
    try:
        if contact is None or not contact.email or not is_valid_email(contact.email):
            return
        tenant_name = tenant.name if tenant else "Yippie"
        primary_color = tenant.primary_color if tenant else None
        agent_name = agent.full_name if agent else tenant_name
        booking_url = f"{CLIENT_BASE_URL}/book/{token.id}"

        first_name = (contact.full_name or "there").split(" ")[0]
        subject = f"{agent_name} would like to book a meeting with you"

        lines = [f"Hi {first_name},", ""]
        if token.message:
            lines += [token.message, ""]
        if token.mode == "propose" and token.proposed_slots:
            lines.append("Proposed times:")
            for s in token.proposed_slots:
                start = datetime.fromisoformat(s["start"])
                end = datetime.fromisoformat(s["end"])
                lines.append(f"  • {_format_slot(start, end)}")
            lines.append("")
            lines.append("Pick a time that works for you here:")
        else:
            lines.append("Choose a time that works for you here:")
        lines += [booking_url, "", f"Sent by {tenant_name} via Yippie."]
        body_text = "\n".join(lines)

        msg_html = (
            f'<p style="margin:0 0 14px 0;line-height:1.55;">'
            f"{_html.escape(token.message).replace(chr(10), '<br>')}</p>"
            if token.message
            else ""
        )
        slots_html = ""
        if token.mode == "propose" and token.proposed_slots:
            items = "".join(
                f'<li style="margin:0 0 6px 0;">'
                f"{_html.escape(_format_slot(datetime.fromisoformat(s['start']), datetime.fromisoformat(s['end'])))}"
                f"</li>"
                for s in token.proposed_slots
            )
            slots_html = (
                '<p style="margin:0 0 8px 0;font-weight:600;">Proposed times:</p>'
                f'<ul style="margin:0 0 14px 0;padding-left:20px;">{items}</ul>'
            )
        content = (
            f'<h2 style="margin:0 0 12px 0;font-size:20px;">Hi {_html.escape(first_name)},</h2>'
            f"{msg_html}{slots_html}"
            f'<p style="margin:18px 0;">'
            f'<a href="{_html.escape(booking_url, quote=True)}" '
            f'style="display:inline-block;padding:12px 24px;background:'
            f'{primary_color or "#5BB8E8"};color:#ffffff;border-radius:6px;'
            f'text-decoration:none;font-weight:600;">Book a time</a></p>'
            f'<p style="margin:18px 0 0 0;font-size:13px;color:#6b7280;">'
            f"Sent by {_html.escape(tenant_name)} via Yippie.</p>"
        )
        html_body = render_email_html(
            body_text,
            tenant_name=tenant_name,
            primary_color=primary_color,
            logo_url=tenant.logo_url if tenant else None,
            prerendered_html=content,
        )
        personal_email = getattr(token, "from_email", None)
        await send_email(
            to=contact.email,
            subject=subject,
            body=body_text,
            html=html_body,
            from_email=personal_email or None,
            reply_to=personal_email or None,
        )
    except Exception:  # noqa: BLE001 — notification must never break the request
        logger.exception("Failed to send booking invitation for token %s", getattr(token, "id", "?"))


async def _notify_customer_confirmed(
    event: CalendarEvent,
    contact: Contact,
    tenant: Optional[Tenant],
    token: Optional[BookingToken] = None,
) -> None:
    try:
        if contact is None or not contact.email or not is_valid_email(contact.email):
            return
        tenant_name = tenant.name if tenant else "Yippie"
        primary_color = tenant.primary_color if tenant else None
        when = _format_slot(event.start_at, event.end_at)
        subject = f"Your meeting with {tenant_name} is confirmed"

        manage_token = getattr(token, "manage_token", None) if token else None
        manage_url = (
            f"{CLIENT_BASE_URL}/book/manage/{manage_token}"
            if manage_token else None
        )

        manage_text_lines = (
            [
                "",
                "Need to reschedule or cancel?",
                manage_url,
            ]
            if manage_url else []
        )

        body_text = "\n".join(
            [
                f"Your meeting with {tenant_name} is confirmed.",
                "",
                when,
            ]
            + manage_text_lines
            + [
                "",
                f"Confirmed via {tenant_name} on Yippie.",
            ]
        )

        manage_html = (
            f'<p style="margin:14px 0 0 0;">'
            f'<a href="{_html.escape(manage_url, quote=True)}" '
            f'style="display:inline-block;padding:10px 20px;background:#f1f5f9;color:#374151;'
            f'border-radius:6px;text-decoration:none;font-weight:600;border:1px solid #e2e8f0;">'
            f'Reschedule or cancel</a></p>'
            if manage_url else ""
        )

        content = (
            f'<h2 style="margin:0 0 12px 0;font-size:20px;">You\'re booked!</h2>'
            f'<p style="margin:0 0 14px 0;">Your meeting with '
            f"{_html.escape(tenant_name)} is confirmed.</p>"
            f'<p style="margin:0 0 14px 0;font-weight:600;color:#374151;">{_html.escape(when)}</p>'
            f"{manage_html}"
            f'<p style="margin:18px 0 0 0;font-size:13px;color:#6b7280;">'
            f"Confirmed via {_html.escape(tenant_name)} on Yippie.</p>"
        )
        html_body = render_email_html(
            body_text,
            tenant_name=tenant_name,
            primary_color=primary_color,
            logo_url=tenant.logo_url if tenant else None,
            prerendered_html=content,
        )
        await send_email(to=contact.email, subject=subject, body=body_text, html=html_body)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to send customer confirmation for event %s", getattr(event, "id", "?"))


async def counter_propose(
    db: AsyncSession,
    token: BookingToken,
    slots: list[SlotProposal],
) -> None:
    """Record the customer's counter-proposed slots and notify the agent."""
    token.customer_proposed_slots = [
        {"start": s.start.isoformat(), "end": s.end.isoformat()} for s in slots
    ]
    token.status_override = "counter_proposed"
    await db.commit()

    contact = await db.get(Contact, token.contact_id)
    agent = await db.get(User, token.created_by)
    asyncio.create_task(_notify_agent_counter_proposed(token, slots, contact, agent))


async def _notify_agent_counter_proposed(
    token: BookingToken,
    slots: list[SlotProposal],
    contact: Optional[Contact],
    agent_user: Optional[User],
) -> None:
    try:
        if agent_user is None:
            return
        to_addr = agent_user.inbound_email or agent_user.email
        if not to_addr or not is_valid_email(to_addr):
            return
        contact_name = contact.full_name if contact else "A contact"
        subject = f"{contact_name} proposed new meeting times"

        slot_lines = [f"  • {_format_slot(s.start, s.end)}" for s in slots]
        body_text = "\n".join(
            [f"{contact_name} has proposed the following times for a meeting:", ""]
            + slot_lines
            + ["", "Log in to accept one of these times."]
        )

        items_html = "".join(
            f'<li style="margin:0 0 6px 0;">{_html.escape(_format_slot(s.start, s.end))}</li>'
            for s in slots
        )
        content = (
            f'<h2 style="margin:0 0 12px 0;font-size:20px;">'
            f"{_html.escape(contact_name)} proposed new meeting times</h2>"
            f'<p style="margin:0 0 8px 0;">They suggested the following times:</p>'
            f'<ul style="margin:0 0 14px 0;padding-left:20px;">{items_html}</ul>'
            f'<p style="margin:0 0 0 0;font-size:13px;color:#6b7280;">Log in to accept one of these times.</p>'
        )
        html_body = render_email_html(body_text, prerendered_html=content)
        await send_email(to=to_addr, subject=subject, body=body_text, html=html_body)
    except Exception:  # noqa: BLE001
        logger.exception(
            "Failed to send counter-propose notification for token %s", getattr(token, "id", "?")
        )


# --------------------------------------------------------------------------- #
# Manage token helpers (BK7)
# --------------------------------------------------------------------------- #
async def get_manage_token(
    db: AsyncSession, manage_token_uuid: uuid.UUID
) -> Optional[BookingToken]:
    """Return BookingToken by manage_token field, or None if not found."""
    return await db.scalar(
        select(BookingToken).where(BookingToken.manage_token == manage_token_uuid)
    )


def _is_locked(event_start_at: datetime, cancel_edit_hours_before: int) -> bool:
    """Return True when the booking is within the lock window."""
    start = event_start_at
    if start.tzinfo is None:
        start = start.replace(tzinfo=timezone.utc)
    return start - _now() <= timedelta(hours=cancel_edit_hours_before)


async def reschedule_booking(
    db: AsyncSession,
    token: BookingToken,
    slot_start: datetime,
    slot_end: datetime,
) -> CalendarEvent:
    """Move the booking to a new time slot.

    Raises ValueError when locked or when the new slot conflicts.
    """
    if slot_start.tzinfo is None:
        slot_start = slot_start.replace(tzinfo=timezone.utc)
    if slot_end.tzinfo is None:
        slot_end = slot_end.replace(tzinfo=timezone.utc)
    if slot_end <= slot_start:
        raise ValueError("Invalid time slot.")

    settings = await db.scalar(
        select(CalendarSettings).where(CalendarSettings.tenant_id == token.tenant_id)
    )
    hours_before = settings.cancel_edit_hours_before if settings else 24

    event = await db.get(CalendarEvent, token.event_id)
    if event is None:
        raise ValueError("No calendar event associated with this booking.")

    if _is_locked(event.start_at, hours_before):
        raise ValueError(
            f"Changes are locked. The meeting starts within {hours_before} hours."
        )

    # Same advisory lock as confirm_booking — serialise against concurrent
    # confirms/reschedules on this agent's calendar before the overlap check.
    await db.execute(
        text("SELECT pg_advisory_xact_lock(hashtext(:tenant), hashtext(:agent))"),
        {"tenant": str(token.tenant_id), "agent": str(token.created_by)},
    )

    # Conflict-check the new slot (exclude the current event from the check).
    conflict = await db.scalar(
        select(CalendarEvent.id).where(
            CalendarEvent.tenant_id == token.tenant_id,
            CalendarEvent.id != event.id,
            CalendarEvent.start_at < slot_end,
            CalendarEvent.end_at > slot_start,
        )
    )
    if conflict is not None:
        raise ValueError("That time is no longer available. Please pick another slot.")

    event.start_at = slot_start
    event.end_at = slot_end
    await db.commit()
    await db.refresh(event)

    contact = await db.get(Contact, token.contact_id)
    agent = await db.get(User, token.created_by)
    tenant = await db.get(Tenant, token.tenant_id)
    asyncio.create_task(_notify_customer_rescheduled(event, contact, tenant, token))
    asyncio.create_task(_notify_agent_rescheduled(event, contact, agent))
    return event


async def cancel_booking(db: AsyncSession, token: BookingToken) -> None:
    """Cancel the booking: delete the calendar event, revoke manage link.

    Raises ValueError when locked.
    """
    settings = await db.scalar(
        select(CalendarSettings).where(CalendarSettings.tenant_id == token.tenant_id)
    )
    hours_before = settings.cancel_edit_hours_before if settings else 24

    event = await db.get(CalendarEvent, token.event_id)
    if event is None:
        raise ValueError("No calendar event associated with this booking.")

    if _is_locked(event.start_at, hours_before):
        raise ValueError(
            f"Changes are locked. The meeting starts within {hours_before} hours."
        )

    contact = await db.get(Contact, token.contact_id)
    agent = await db.get(User, token.created_by)

    # Delete the event — FK on booking_tokens.event_id is SET NULL, so the token survives.
    await db.delete(event)

    # Revoke the booking state and manage link.
    token.booked_at = None
    token.manage_token = None
    token.event_id = None

    await db.commit()

    asyncio.create_task(_notify_agent_cancelled(contact, agent))


# --------------------------------------------------------------------------- #
# Reschedule / cancel email helpers
# --------------------------------------------------------------------------- #
async def _notify_customer_rescheduled(
    event: CalendarEvent,
    contact: Optional[Contact],
    tenant: Optional[Tenant],
    token: Optional[BookingToken] = None,
) -> None:
    try:
        if contact is None or not contact.email or not is_valid_email(contact.email):
            return
        tenant_name = tenant.name if tenant else "Yippie"
        primary_color = tenant.primary_color if tenant else None
        when = _format_slot(event.start_at, event.end_at)
        subject = f"Your meeting with {tenant_name} has been rescheduled"

        manage_token = getattr(token, "manage_token", None) if token else None
        manage_url = (
            f"{CLIENT_BASE_URL}/book/manage/{manage_token}" if manage_token else None
        )
        manage_text_lines = (
            ["", "Need to reschedule or cancel again?", manage_url] if manage_url else []
        )

        body_text = "\n".join(
            [
                f"Your meeting with {tenant_name} has been rescheduled.",
                "",
                f"New time: {when}",
            ]
            + manage_text_lines
            + [
                "",
                f"Via {tenant_name} on Yippie.",
            ]
        )

        manage_html = (
            f'<p style="margin:14px 0 0 0;">'
            f'<a href="{_html.escape(manage_url, quote=True)}" '
            f'style="display:inline-block;padding:10px 20px;background:#f1f5f9;color:#374151;'
            f'border-radius:6px;text-decoration:none;font-weight:600;border:1px solid #e2e8f0;">'
            f'Reschedule or cancel</a></p>'
            if manage_url else ""
        )
        content = (
            f'<h2 style="margin:0 0 12px 0;font-size:20px;">Meeting rescheduled</h2>'
            f'<p style="margin:0 0 14px 0;">Your meeting with '
            f"{_html.escape(tenant_name)} has been rescheduled.</p>"
            f'<p style="margin:0 0 14px 0;font-weight:600;color:#374151;">'
            f'New time: {_html.escape(when)}</p>'
            f"{manage_html}"
            f'<p style="margin:18px 0 0 0;font-size:13px;color:#6b7280;">'
            f"Via {_html.escape(tenant_name)} on Yippie.</p>"
        )
        html_body = render_email_html(
            body_text,
            tenant_name=tenant_name,
            primary_color=primary_color,
            logo_url=tenant.logo_url if tenant else None,
            prerendered_html=content,
        )
        await send_email(to=contact.email, subject=subject, body=body_text, html=html_body)
    except Exception:  # noqa: BLE001
        logger.exception(
            "Failed to send customer reschedule notification for event %s",
            getattr(event, "id", "?"),
        )


async def _notify_agent_rescheduled(
    event: CalendarEvent, contact: Optional[Contact], agent_user: Optional[User]
) -> None:
    try:
        if agent_user is None:
            return
        to_addr = agent_user.inbound_email or agent_user.email
        if not to_addr or not is_valid_email(to_addr):
            return
        when = _format_slot(event.start_at, event.end_at)
        contact_name = contact.full_name if contact else "A contact"
        subject = f"{contact_name} rescheduled their meeting: {when}"
        body_text = "\n".join(
            [f"{contact_name} rescheduled their meeting.", "", f"New time: {when}"]
        )
        content = (
            f'<h2 style="margin:0 0 12px 0;font-size:20px;">'
            f"{_html.escape(contact_name)} rescheduled</h2>"
            f'<p style="margin:0 0 14px 0;font-weight:600;color:#374151;">'
            f'New time: {_html.escape(when)}</p>'
        )
        html_body = render_email_html(body_text, prerendered_html=content)
        await send_email(to=to_addr, subject=subject, body=body_text, html=html_body)
    except Exception:  # noqa: BLE001
        logger.exception(
            "Failed to send agent reschedule notification for event %s",
            getattr(event, "id", "?"),
        )


async def _notify_agent_cancelled(
    contact: Optional[Contact], agent_user: Optional[User]
) -> None:
    try:
        if agent_user is None:
            return
        to_addr = agent_user.inbound_email or agent_user.email
        if not to_addr or not is_valid_email(to_addr):
            return
        contact_name = contact.full_name if contact else "A contact"
        subject = f"{contact_name} cancelled their meeting"
        body_text = f"{contact_name} cancelled their meeting."
        content = (
            f'<h2 style="margin:0 0 12px 0;font-size:20px;">'
            f"{_html.escape(contact_name)} cancelled their meeting</h2>"
        )
        html_body = render_email_html(body_text, prerendered_html=content)
        await send_email(to=to_addr, subject=subject, body=body_text, html=html_body)
    except Exception:  # noqa: BLE001
        logger.exception(
            "Failed to send agent cancellation notification for contact %s",
            getattr(contact, "id", "?"),
        )


async def _notify_agent_confirmed(
    event: CalendarEvent, contact: Contact, agent_user: Optional[User]
) -> None:
    try:
        if agent_user is None:
            return
        to_addr = agent_user.inbound_email or agent_user.email
        if not to_addr or not is_valid_email(to_addr):
            return
        when = _format_slot(event.start_at, event.end_at)
        contact_name = contact.full_name if contact else "A contact"
        subject = f"{contact_name} booked a meeting: {when}"

        lines = [f"{contact_name} booked a meeting.", "", when]
        if contact and contact.email:
            lines += ["", f"Contact email: {contact.email}"]
        body_text = "\n".join(lines)

        contact_html = (
            f'<p style="margin:0 0 14px 0;">Contact: {_html.escape(contact.email)}</p>'
            if contact and contact.email
            else ""
        )
        content = (
            f'<h2 style="margin:0 0 12px 0;font-size:20px;">'
            f"{_html.escape(contact_name)} booked a meeting</h2>"
            f'<p style="margin:0 0 14px 0;font-weight:600;color:#374151;">{_html.escape(when)}</p>'
            f"{contact_html}"
        )
        html_body = render_email_html(body_text, prerendered_html=content)
        await send_email(to=to_addr, subject=subject, body=body_text, html=html_body)
    except Exception:  # noqa: BLE001
        logger.exception("Failed to send agent confirmation for event %s", getattr(event, "id", "?"))
