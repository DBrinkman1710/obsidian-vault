from __future__ import annotations

import hashlib
import ipaddress
import logging
import uuid
from datetime import date, datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlparse
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import httpx
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.modules.external_calendar.models import ExternalCalendarEvent, ExternalCalendarFeed
from app.modules.external_calendar.schemas import ExternalCalendarFeedCreate, ExternalCalendarFeedUpdate

log = logging.getLogger(__name__)

MAX_FEEDS_PER_USER = 5


def _normalize_url(raw: str) -> str:
    url = raw.strip()
    if url.startswith("webcal://"):
        url = "https://" + url[9:]
    if not url.startswith(("http://", "https://")):
        raise ValueError("iCal URL must start with http://, https://, or webcal://")
    hostname = urlparse(url).hostname or ""
    if not hostname:
        raise ValueError("Invalid iCal URL: missing hostname")
    try:
        ip = ipaddress.ip_address(hostname)
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast:
            raise ValueError("iCal URL must not point to private or local addresses")
    except ValueError as exc:
        if "does not appear to be an IPv4 or IPv6 address" not in str(exc):
            raise
    return url


async def list_feeds(
    db: AsyncSession, tenant_id: uuid.UUID, user_id: uuid.UUID
) -> list[ExternalCalendarFeed]:
    result = await db.execute(
        select(ExternalCalendarFeed).where(
            ExternalCalendarFeed.tenant_id == tenant_id,
            ExternalCalendarFeed.user_id == user_id,
        ).order_by(ExternalCalendarFeed.created_at)
    )
    return list(result.scalars().all())


async def create_feed(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    data: ExternalCalendarFeedCreate,
) -> ExternalCalendarFeed:
    existing = await db.execute(
        select(ExternalCalendarFeed).where(
            ExternalCalendarFeed.tenant_id == tenant_id,
            ExternalCalendarFeed.user_id == user_id,
        )
    )
    if len(existing.scalars().all()) >= MAX_FEEDS_PER_USER:
        raise ValueError(f"Maximum of {MAX_FEEDS_PER_USER} calendar feeds allowed per user.")

    url = _normalize_url(data.ical_url)
    feed = ExternalCalendarFeed(
        tenant_id=tenant_id,
        user_id=user_id,
        name=data.name,
        ical_url=url,
    )
    db.add(feed)
    await db.commit()
    await db.refresh(feed)
    return feed


async def update_feed(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    feed_id: uuid.UUID,
    data: ExternalCalendarFeedUpdate,
) -> Optional[ExternalCalendarFeed]:
    feed = await db.scalar(
        select(ExternalCalendarFeed).where(
            ExternalCalendarFeed.id == feed_id,
            ExternalCalendarFeed.tenant_id == tenant_id,
            ExternalCalendarFeed.user_id == user_id,
        )
    )
    if feed is None:
        return None
    if data.name is not None:
        feed.name = data.name
    if data.ical_url is not None:
        feed.ical_url = _normalize_url(data.ical_url)
    if data.is_active is not None:
        feed.is_active = data.is_active
    await db.commit()
    await db.refresh(feed)
    return feed


async def delete_feed(
    db: AsyncSession,
    tenant_id: uuid.UUID,
    user_id: uuid.UUID,
    feed_id: uuid.UUID,
) -> bool:
    feed = await db.scalar(
        select(ExternalCalendarFeed).where(
            ExternalCalendarFeed.id == feed_id,
            ExternalCalendarFeed.tenant_id == tenant_id,
            ExternalCalendarFeed.user_id == user_id,
        )
    )
    if feed is None:
        return False
    await db.delete(feed)
    await db.commit()
    return True


def _to_utc(dt: datetime | date, tzid: str | None) -> datetime:
    """Convert an icalendar date/datetime to a UTC-aware datetime."""
    if isinstance(dt, datetime):
        if dt.tzinfo is not None:
            return dt.astimezone(timezone.utc)
        # Floating time: interpret in the provided TZID, fall back to UTC.
        if tzid:
            try:
                tz = ZoneInfo(tzid)
                return dt.replace(tzinfo=tz).astimezone(timezone.utc)
            except (ZoneInfoNotFoundError, Exception):
                pass
        return dt.replace(tzinfo=timezone.utc)
    else:
        # DATE (all-day) — treat as midnight UTC
        return datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)


async def sync_feed(db: AsyncSession, feed: ExternalCalendarFeed) -> int:
    """Fetch, parse, and cache events from a single iCal feed. Returns upserted count."""
    import icalendar
    import recurring_ical_events

    now = datetime.now(timezone.utc)
    window_end = now + timedelta(days=feed.sync_window_days)

    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            resp = await client.get(feed.ical_url)
            resp.raise_for_status()
            raw = resp.content
    except Exception as exc:
        err = str(exc)[:500]
        log.warning("External calendar fetch failed for feed %s: %s", feed.id, err)
        feed.last_sync_error = err
        await db.commit()
        return 0

    try:
        cal = icalendar.Calendar.from_ical(raw)
        occurrences = recurring_ical_events.of(cal).between(now, window_end)
    except Exception as exc:
        err = f"Parse error: {str(exc)[:490]}"
        log.warning("External calendar parse failed for feed %s: %s", feed.id, err)
        feed.last_sync_error = err
        await db.commit()
        return 0

    seen_uids: set[str] = set()
    upsert_rows: list[dict] = []

    for vevent in occurrences:
        if str(vevent.get("STATUS", "")).upper() == "CANCELLED":
            continue

        uid_val = vevent.get("UID")
        dtstart = vevent.get("DTSTART")
        dtend = vevent.get("DTEND")

        if dtstart is None:
            continue

        dtstart_val = dtstart.dt
        tzid = str(dtstart.params.get("TZID", "")) or None

        # Determine all-day
        all_day = isinstance(dtstart_val, date) and not isinstance(dtstart_val, datetime)

        start_utc = _to_utc(dtstart_val, tzid)

        if dtend is not None:
            dtend_val = dtend.dt
            end_tzid = str(dtend.params.get("TZID", "")) or None
            end_utc = _to_utc(dtend_val, end_tzid)
        else:
            # All-day without DTEND: one day
            end_utc = start_utc + timedelta(days=1)

        if end_utc <= now:
            continue

        # Build UID
        if uid_val:
            uid_str = str(uid_val) + "@" + start_utc.isoformat()
        else:
            summary = str(vevent.get("SUMMARY", ""))
            uid_str = hashlib.sha256(
                f"{feed.id}:{start_utc.isoformat()}:{summary}".encode()
            ).hexdigest()[:32]

        seen_uids.add(uid_str)
        upsert_rows.append({
            "id": uuid.uuid4(),
            "tenant_id": feed.tenant_id,
            "user_id": feed.user_id,
            "feed_id": feed.id,
            "uid": uid_str,
            "start_at": start_utc,
            "end_at": end_utc,
            "all_day": all_day,
        })

    if upsert_rows:
        stmt = pg_insert(ExternalCalendarEvent).values(upsert_rows)
        stmt = stmt.on_conflict_do_update(
            constraint="uq_ext_cal_events_feed_uid",
            set_={"start_at": stmt.excluded.start_at, "end_at": stmt.excluded.end_at},
        )
        await db.execute(stmt)

    # Remove events no longer in the feed
    if seen_uids:
        stale = await db.execute(
            select(ExternalCalendarEvent).where(
                ExternalCalendarEvent.feed_id == feed.id,
                ExternalCalendarEvent.uid.not_in(seen_uids),
            )
        )
        for ev in stale.scalars().all():
            await db.delete(ev)
    else:
        stale_all = await db.execute(
            select(ExternalCalendarEvent).where(
                ExternalCalendarEvent.feed_id == feed.id
            )
        )
        for ev in stale_all.scalars().all():
            await db.delete(ev)

    feed.last_synced_at = now
    feed.last_sync_error = None
    await db.commit()
    return len(upsert_rows)


async def sync_all_active_feeds(db: AsyncSession) -> None:
    """Sync all active feeds across all tenants. Runs as connecting role (no RLS)."""
    result = await db.execute(
        select(ExternalCalendarFeed).where(ExternalCalendarFeed.is_active.is_(True))
    )
    feeds = result.scalars().all()
    for feed in feeds:
        try:
            count = await sync_feed(db, feed)
            log.info("Synced feed %s (%s): %d events", feed.id, feed.name, count)
        except Exception:
            log.exception("Unexpected error syncing feed %s", feed.id)
