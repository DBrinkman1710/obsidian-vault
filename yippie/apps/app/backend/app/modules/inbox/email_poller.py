"""
Polls Resend's received-emails API every 10 seconds.
Handles two cases per email:
  - New (no DB row yet): full ingest — fetch body, create message + AI draft
  - Existing but body empty: re-fetch body, update message + re-run AI scan on draft
Emails with a body already stored are skipped.
"""
from __future__ import annotations

import logging
import os
from html.parser import HTMLParser

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError

from app.config import get_settings
from app.core.models import Tenant
from app.core.tenant import get_inbound_email_map, resolve_tenant_by_inbound_email
from app.database import db_session
from app.modules.inbox import service

log = logging.getLogger(__name__)
scheduler = AsyncIOScheduler()


def _html_to_text(html: str) -> str:
    """Strip HTML tags to readable plain text, skipping style/script/head content."""
    class _Stripper(HTMLParser):
        def __init__(self) -> None:
            super().__init__()
            self._parts: list[str] = []
            self._skip = False

        def handle_starttag(self, tag: str, attrs: list) -> None:
            if tag in ("style", "script", "head"):
                self._skip = True

        def handle_endtag(self, tag: str) -> None:
            if tag in ("style", "script", "head"):
                self._skip = False

        def handle_data(self, data: str) -> None:
            if not self._skip and data.strip():
                self._parts.append(data.strip())

    s = _Stripper()
    s.feed(html)
    return "\n".join(s._parts)


async def _fetch_email_data(client: httpx.AsyncClient, auth: dict, email_id: str) -> tuple[str, str | None]:
    """Fetch body + attachment metadata for a received email.

    Returns (body_text, attachments_json | None). body_text is '' on failure.
    attachments_json is a JSON string of [{id, filename, content_type}] or None.
    """
    import json as _json
    resp = await client.get(
        f"https://api.resend.com/emails/receiving/{email_id}",
        headers=auth,
    )
    if resp.status_code != 200:
        log.warning("Body fetch %s → HTTP %s: %s", email_id, resp.status_code, resp.text[:300])
        return "", None

    full = resp.json()
    text = full.get("text")
    html = full.get("html")

    log.info("Body fetch %s → fields: text=%r html_len=%s", email_id, (text or "")[:80], len(html or ""))

    if not text and not html:
        log.warning("Body fetch %s → 200 but both text and html null. Full response: %s", email_id, resp.text[:500])
        return "", None

    body = (text or "").strip() or _html_to_text(html or "").strip()
    if not body:
        log.warning("Body fetch %s → empty body. text=%r html=%r", email_id, text, (html or "")[:200])

    # Extract attachments — store content inline (base64) so the download proxy
    # doesn't need a separate Resend API call (no such endpoint exists).
    attachments_json: str | None = None
    raw_atts = full.get("attachments") or []
    parsed = [
        {
            "id": a["id"],
            "filename": a.get("filename", "attachment"),
            "content_type": a.get("content_type", "application/octet-stream"),
            "content": a.get("content", ""),
        }
        for a in raw_atts if a.get("id")
    ]
    if parsed:
        attachments_json = _json.dumps(parsed)

    return body, attachments_json


@scheduler.scheduled_job("interval", seconds=30, id="email_poll", max_instances=1, coalesce=True)
async def poll_inbound_emails() -> None:
    settings = get_settings()
    if not settings.resend_api_key:
        return

    auth = {"Authorization": f"Bearer {settings.resend_api_key}"}

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            list_resp = await client.get(
                "https://api.resend.com/emails/receiving",
                headers=auth,
                params={"limit": 50},
            )
            if list_resp.status_code != 200:
                log.warning("Resend list → HTTP %s: %s", list_resp.status_code, list_resp.text[:300])
                return

            emails = list_resp.json().get("data", [])
            if not emails:
                return

            def _to_text(m: dict) -> str:
                """Flatten all 'to' recipients into a single lowercase string for matching."""
                raw = m.get("to") or []
                if isinstance(raw, str):
                    return raw.lower()
                parts = []
                for t in raw:
                    if isinstance(t, dict):
                        parts.append(t.get("email", "").lower())
                        parts.append(t.get("name", "").lower())
                    else:
                        parts.append(str(t).lower())
                return " ".join(parts)

            def _first_to_addr(m: dict) -> str:
                """Extract the first recipient email as a normalized lowercase string."""
                raw = m.get("to") or []
                if isinstance(raw, str):
                    return raw.lower().strip()
                for t in raw:
                    if isinstance(t, dict):
                        return t.get("email", "").lower().strip()
                    return str(t).lower().strip()
                return ""

            # Build per-tenant routing map: {inbound_email_lower: (tenant_id, ai_enabled)}
            async with db_session() as db:
                inbound_map = await get_inbound_email_map(db)

            # Fallback: INBOUND_EMAIL env var → first tenant in DB (keeps existing setup working
            # for tenants whose inbound_email field hasn't been set in the DB yet)
            fallback_addr = (settings.inbound_email or "").lower().strip()
            fallback_tenant_id = None
            fallback_ai_scan = False

            # Assign each email to a tenant
            routed: list[tuple] = []  # (meta, tenant_id, ai_scan)
            for meta in emails:
                addr = _first_to_addr(meta)
                if addr in inbound_map:
                    tid, ai = inbound_map[addr]
                    routed.append((meta, tid, ai))
                elif fallback_addr and fallback_addr in _to_text(meta):
                    routed.append((meta, None, None))  # resolved below

            if not routed:
                return

            # Resolve fallback tenant once if needed (look up by inbound_email, not first-in-DB)
            if any(tid is None for _, tid, _ in routed):
                async with db_session() as db:
                    fallback_tenant_id = await resolve_tenant_by_inbound_email(db, fallback_addr) if fallback_addr else None
                    if fallback_tenant_id is None:
                        # Mail addressed to this container's own INBOUND_EMAIL belongs to the
                        # platform's seed tenant even when no tenant claims the address —
                        # otherwise the shared inbox silently drops it.
                        result = await db.execute(
                            select(Tenant.id).where(Tenant.slug == os.getenv("TENANT_ID", "default"))
                        )
                        fallback_tenant_id = result.scalar_one_or_none()
                    if fallback_tenant_id:
                        t = await db.get(Tenant, fallback_tenant_id)
                        fallback_ai_scan = t is not None and "ai" in (t.enabled_modules or [])
                    else:
                        fallback_ai_scan = False

            resolved: list[tuple] = []
            for meta, tid, ai in routed:
                if tid is None:
                    if fallback_tenant_id:
                        resolved.append((meta, fallback_tenant_id, fallback_ai_scan))
                else:
                    resolved.append((meta, tid, ai))

            if not resolved:
                return

            # Determine which emails need processing
            to_ingest: list[tuple] = []   # (meta, tenant_id, ai_scan)
            to_update: list[tuple] = []   # (existing_msg, meta, tenant_id, ai_scan)

            async with db_session() as db:
                for meta, tid, ai in resolved:
                    existing = await service.find_by_resend_id(db, meta["id"])
                    if existing and existing.raw_body:
                        continue
                    if existing:
                        to_update.append((existing, meta, tid, ai))
                    else:
                        to_ingest.append((meta, tid, ai))

            if not to_ingest and not to_update:
                return

            # Fetch all bodies + attachment metadata in parallel
            import asyncio as _asyncio
            ids_needed = [m["id"] for m, _, _ in to_ingest] + [m["id"] for _, m, _, _ in to_update]
            fetch_results = await _asyncio.gather(
                *[_fetch_email_data(client, auth, eid) for eid in ids_needed],
                return_exceptions=True,
            )
            body_map: dict[str, str] = {}
            att_map: dict[str, str | None] = {}
            for eid, result in zip(ids_needed, fetch_results):
                if isinstance(result, tuple):
                    body, atts = result
                    if body:
                        body_map[eid] = body
                        att_map[eid] = atts

            # Process with a fresh DB session
            async with db_session() as db:
                for meta, tid, ai in to_ingest:
                    body = body_map.get(meta["id"])
                    if not body:
                        continue
                    log.info("Ingesting %s from=%s subject=%r body_len=%d ai_scan=%s tenant=%s",
                             meta["id"], meta.get("from"), meta.get("subject"), len(body), ai, tid)
                    raw_to = meta.get("to") or []
                    inbound_to: str | None = None
                    if isinstance(raw_to, list) and raw_to:
                        first = raw_to[0]
                        inbound_to = first.get("email") if isinstance(first, dict) else str(first)
                    elif isinstance(raw_to, str):
                        inbound_to = raw_to
                    try:
                        await service.ingest_email(
                            db=db,
                            tenant_id=tid,
                            sender=meta.get("from") or "",
                            subject=meta.get("subject") or None,
                            body=body,
                            resend_email_id=meta["id"],
                            inbound_to=inbound_to,
                            attachments_json=att_map.get(meta["id"]),
                            ai_scan=ai,
                        )
                    except IntegrityError:
                        # devsandbox and sandbox share one DB, so both pollers can pass
                        # the find_by_resend_id check before either commits. The unique
                        # index on resend_email_id rejects the loser — skip just this
                        # email instead of aborting the rest of the batch.
                        await db.rollback()
                        log.info("Skipping %s — already ingested by the other container", meta["id"])

                for existing, meta, tid, ai in to_update:
                    body = body_map.get(meta["id"])
                    if not body:
                        continue
                    log.info("Updating body for %s (was empty) ai_scan=%s", meta["id"], ai)
                    atts = att_map.get(meta["id"])
                    if atts is not None:
                        existing.attachments_json = atts
                    await service.update_message_body(db, tid, existing, body, ai_scan=ai)

    except Exception:
        log.exception("email_poll failed")


@scheduler.scheduled_job("interval", seconds=10, id="enrich_drafts", max_instances=1, coalesce=True)
async def enrich_drafts_job() -> None:
    """AI-enrich drafts queued by ingest. Loops until the queue is drained so a
    burst of mail doesn't wait multiple ticks, then sleeps until the next one."""
    try:
        while True:
            async with db_session() as db:
                processed = await service.enrich_queued_drafts(db)
            if processed < service.ENRICH_BATCH_SIZE:
                break
    except Exception:
        log.exception("enrich_drafts failed")


@scheduler.scheduled_job("interval", seconds=5, id="flush_pending_sends", max_instances=1, coalesce=True)
async def flush_pending_sends_job() -> None:
    """Dispatch queued emails whose undo window has expired."""
    async with db_session() as db:
        await service.flush_pending_sends(db)


@scheduler.scheduled_job("interval", hours=1, id="retention", max_instances=1, coalesce=True)
async def retention_job() -> None:
    """Spam → Bin after 10 working days; Bin emptied after 20 working days (item 42)."""
    try:
        async with db_session() as db:
            await service.apply_retention(db)
    except Exception:
        log.exception("retention failed")


@scheduler.scheduled_job("interval", seconds=60, id="go_live_check", max_instances=1, coalesce=True)
async def go_live_job() -> None:
    """Activate tenants whose go_live_at date has passed: live, out of demo.
    go_live_at is cleared so this is one-shot — re-demoing a client later won't
    be instantly reverted. Idempotent, so safe with two containers on one DB."""
    from sqlalchemy import func, update

    async with db_session() as db:
        result = await db.execute(
            update(Tenant)
            .where(Tenant.go_live_at.isnot(None), Tenant.go_live_at <= func.now())
            .values(is_active=True, is_demo=False, go_live_at=None)
        )
        await db.commit()
        if result.rowcount:
            log.info("go_live_job: activated %d tenant(s)", result.rowcount)


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()
