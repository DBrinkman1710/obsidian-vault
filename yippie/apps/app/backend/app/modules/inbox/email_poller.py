"""
Polls Resend's received-emails API every 10 seconds.
Handles two cases per email:
  - New (no DB row yet): full ingest — fetch body, create message + AI draft
  - Existing but body empty: re-fetch body, update message + re-run AI scan on draft
Emails with a body already stored are skipped.
"""
from __future__ import annotations

import logging
from html.parser import HTMLParser

import httpx
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.config import get_settings
from app.core.models import Tenant
from app.core.tenant import resolve_tenant_uuid
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


async def _fetch_body(client: httpx.AsyncClient, auth: dict, email_id: str) -> str:
    """Fetch plain-text body for a received email. Returns '' on any failure."""
    resp = await client.get(
        f"https://api.resend.com/emails/receiving/{email_id}",
        headers=auth,
    )
    if resp.status_code != 200:
        log.warning("Body fetch %s → HTTP %s: %s", email_id, resp.status_code, resp.text[:300])
        return ""

    full = resp.json()
    text = full.get("text")
    html = full.get("html")

    # Always log the full response so we can see exactly what Resend returns
    log.info("Body fetch %s → fields: text=%r html_len=%s", email_id, (text or "")[:80], len(html or ""))

    if not text and not html:
        log.warning("Body fetch %s → 200 but both text and html null. Full response: %s", email_id, resp.text[:500])
        return ""

    body = (text or "").strip() or _html_to_text(html or "").strip()
    if not body:
        log.warning("Body fetch %s → 200 but extracted body is empty whitespace. text=%r html=%r", email_id, text, (html or "")[:200])
    return body


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

            # Filter by inbound address so each environment only picks up its own mail.
            # INBOUND_EMAIL env var (e.g. dev-support@getyippie.com) must match the `to` field.
            # Resend may return `to` as a plain string, a list of strings, or a list of objects.
            # We use substring matching to handle angle-bracket formats like "<addr@domain>".
            filter_addr = (settings.inbound_email or "").lower().strip()
            if filter_addr:
                def _to_text(m: dict) -> str:
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

                total_before = len(emails)
                emails = [m for m in emails if filter_addr in _to_text(m)]
                log.info("email_poll: INBOUND_EMAIL=%s matched %d/%d emails",
                         filter_addr, len(emails), total_before)
                if not emails:
                    return

            # Determine which emails need processing before opening the DB session
            # so the expensive work (HTTP + AI) doesn't hold a connection open needlessly
            async with db_session() as db:
                tenant_id = await resolve_tenant_uuid(db)
                tenant = await db.get(Tenant, tenant_id)
                ai_scan = tenant is not None and "aitools" in (tenant.enabled_modules or [])

                # Separate into "needs fresh ingest" vs "needs body update"
                to_ingest: list[dict] = []
                to_update: list[tuple] = []  # (existing_msg, meta)

                for meta in emails:
                    email_id: str = meta["id"]
                    existing = await service.find_by_resend_id(db, email_id)
                    if existing and existing.raw_body:
                        continue
                    if existing:
                        to_update.append((existing, meta))
                    else:
                        to_ingest.append(meta)

            if not to_ingest and not to_update:
                return

            # Fetch all bodies in parallel
            import asyncio as _asyncio
            ids_needed = [m["id"] for m in to_ingest] + [m["id"] for _, m in to_update]
            bodies = await _asyncio.gather(
                *[_fetch_body(client, auth, eid) for eid in ids_needed],
                return_exceptions=True,
            )
            body_map: dict[str, str] = {
                eid: b for eid, b in zip(ids_needed, bodies)
                if isinstance(b, str) and b
            }

            # Now process with a fresh DB session
            async with db_session() as db:
                tenant_id = await resolve_tenant_uuid(db)

                for meta in to_ingest:
                    body = body_map.get(meta["id"])
                    if not body:
                        continue
                    log.info("Ingesting %s from=%s subject=%r body_len=%d ai_scan=%s",
                             meta["id"], meta.get("from"), meta.get("subject"), len(body), ai_scan)
                    to_list = meta.get("to") or []
                    inbound_to = to_list[0] if to_list else None
                    await service.ingest_email(
                        db=db,
                        tenant_id=tenant_id,
                        sender=meta.get("from") or "",
                        subject=meta.get("subject") or None,
                        body=body,
                        resend_email_id=meta["id"],
                        inbound_to=inbound_to,
                        ai_scan=ai_scan,
                    )

                for existing, meta in to_update:
                    body = body_map.get(meta["id"])
                    if not body:
                        continue
                    log.info("Updating body for %s (was empty) ai_scan=%s", meta["id"], ai_scan)
                    await service.update_message_body(db, tenant_id, existing, body, ai_scan=ai_scan)

    except Exception:
        log.exception("email_poll failed")


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()
