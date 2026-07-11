from __future__ import annotations

import logging
import re
from typing import Optional

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)

# Pragmatic single-line email check — full RFC validation is not the goal, just
# rejecting obviously malformed addresses before they reach the mail provider.
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def is_valid_email(addr: str) -> bool:
    return bool(_EMAIL_RE.match((addr or "").strip()))


def email_domain(addr: str) -> str:
    addr = (addr or "").strip().lower()
    return addr.rsplit("@", 1)[-1] if "@" in addr else ""


class ResendNotConfiguredError(Exception):
    pass


async def send_email(
    to: str,
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
    attachments: Optional[list[dict]] = None,
    from_email: Optional[str] = None,
    html: Optional[str] = None,
    headers: Optional[dict[str, str]] = None,
    cc: Optional[list[str]] = None,
    bcc: Optional[list[str]] = None,
) -> str | None:
    """Send an email via Resend.

    attachments: list of {"filename": str, "content": base64_str, "content_type": str}
    from_email: override the sender address (must be on a Resend-verified domain)
    html: optional HTML part — sent alongside the plain-text body (which stays
          the fallback for clients that prefer text)
    headers: optional dict of custom email headers (e.g. List-Unsubscribe)
    cc: list of CC email addresses (visible to all recipients)
    bcc: list of BCC email addresses (hidden from other recipients)
    """
    settings = get_settings()

    if not settings.resend_api_key:
        raise ResendNotConfiguredError(
            "RESEND_API_KEY must be set to send emails."
        )

    from_addr = from_email or settings.resend_from or "diederik@getyippie.com"

    payload: dict = {
        "from": from_addr,
        "to": [to],
        "subject": subject,
        "text": body,
    }
    if html:
        payload["html"] = html
    if reply_to:
        payload["reply_to"] = [reply_to]
    if attachments:
        # Resend expects only {filename, content} — strip any extra keys (e.g. content_type)
        payload["attachments"] = [{"filename": a["filename"], "content": a["content"]} for a in attachments]
    if headers:
        payload["headers"] = headers
    if cc:
        payload["cc"] = [c for c in cc if is_valid_email(c)]
    if bcc:
        payload["bcc"] = [b for b in bcc if is_valid_email(b)]

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json=payload,
            timeout=10,
        )
        response.raise_for_status()
        data = response.json()
        return data.get("id")


async def notify_owner(subject: str, body: str) -> None:
    settings = get_settings()
    if settings.environment != "production":
        return
    to = settings.owner_notification_email
    if not to or not is_valid_email(to):
        return
    try:
        await send_email(to=to, subject=subject, body=body)
    except Exception:
        # Best effort by design (often fired from asyncio.create_task), but a
        # silent pass hid every Resend outage — log it so failures are visible.
        logger.exception("notify_owner: failed to send %r to %s", subject, to)
