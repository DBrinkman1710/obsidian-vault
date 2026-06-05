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


@scheduler.scheduled_job("interval", seconds=10, id="email_poll")
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

            async with db_session() as db:
                tenant_id = await resolve_tenant_uuid(db)

                for meta in emails:
                    email_id: str = meta["id"]
                    existing = await service.find_by_resend_id(db, email_id)

                    if existing and existing.raw_body:
                        continue  # Already fully ingested

                    body = await _fetch_body(client, auth, email_id)
                    if not body:
                        continue  # Can't get body yet — will retry next poll

                    if existing:
                        # Had resend_email_id set but empty body — update in place
                        log.info("Updating body for %s (was empty)", email_id)
                        await service.update_message_body(db, tenant_id, existing, body)
                    else:
                        log.info(
                            "Ingesting %s from=%s subject=%r body_len=%d",
                            email_id, meta.get("from"), meta.get("subject"), len(body),
                        )
                        await service.ingest_email(
                            db=db,
                            tenant_id=tenant_id,
                            sender=meta.get("from") or "",
                            subject=meta.get("subject") or None,
                            body=body,
                            resend_email_id=email_id,
                        )

    except Exception:
        log.exception("email_poll failed")


def start_scheduler() -> None:
    if not scheduler.running:
        scheduler.start()
