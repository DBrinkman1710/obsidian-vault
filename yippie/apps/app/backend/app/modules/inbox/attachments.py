"""Resend inbound-attachment fetching.

Resend does NOT include attachment bytes in GET /emails/receiving/{id} —
content lives behind GET /emails/receiving/{email_id}/attachments, which
returns metadata plus a pre-signed (no auth header) expiring download_url
per attachment.
"""
import logging

import httpx

log = logging.getLogger("yippie.inbox.attachments")

MAX_STORED_ATTACHMENT_BYTES = 10 * 1024 * 1024  # mirror the outbound per-file cap


async def fetch_attachment_list(
    client: httpx.AsyncClient, auth: dict, resend_email_id: str
) -> list[dict]:
    """List attachments for a received email. Returns [] on any failure."""
    try:
        resp = await client.get(
            f"https://api.resend.com/emails/receiving/{resend_email_id}/attachments",
            headers=auth,
        )
    except httpx.HTTPError as exc:
        log.warning("Attachment list %s → %s", resend_email_id, exc)
        return []
    if resp.status_code != 200:
        log.warning(
            "Attachment list %s → HTTP %s: %s",
            resend_email_id, resp.status_code, resp.text[:300],
        )
        return []
    return resp.json().get("data", []) or []


async def fetch_attachment_bytes(
    client: httpx.AsyncClient, download_url: str
) -> bytes | None:
    """Download attachment bytes via the pre-signed URL (no auth header)."""
    try:
        resp = await client.get(download_url, follow_redirects=True)
    except httpx.HTTPError as exc:
        log.warning("Attachment download → %s", exc)
        return None
    if resp.status_code != 200:
        log.warning("Attachment download → HTTP %s", resp.status_code)
        return None
    return resp.content
