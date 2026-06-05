from __future__ import annotations

from typing import Optional

import httpx

from app.config import get_settings


class ResendNotConfiguredError(Exception):
    pass


async def send_email(
    to: str,
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
    attachments: Optional[list[dict]] = None,
) -> None:
    """Send an email via Resend.

    attachments: list of {"filename": str, "content": base64_str, "content_type": str}
    """
    settings = get_settings()

    if not settings.resend_api_key:
        raise ResendNotConfiguredError(
            "RESEND_API_KEY must be set to send emails."
        )

    from_addr = settings.resend_from or "support@getyippie.com"

    payload: dict = {
        "from": from_addr,
        "to": [to],
        "subject": subject,
        "text": body,
    }
    if reply_to:
        payload["reply_to"] = [reply_to]
    if attachments:
        payload["attachments"] = attachments

    async with httpx.AsyncClient() as client:
        response = await client.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {settings.resend_api_key}"},
            json=payload,
            timeout=10,
        )
        response.raise_for_status()
