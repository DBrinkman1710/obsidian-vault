from __future__ import annotations

from typing import Optional

import httpx

from app.config import get_settings


class MailgunNotConfiguredError(Exception):
    pass


async def send_email(
    to: str,
    subject: str,
    body: str,
    reply_to: Optional[str] = None,
) -> None:
    settings = get_settings()

    if not settings.mailgun_api_key or not settings.mailgun_domain:
        raise MailgunNotConfiguredError(
            "MAILGUN_API_KEY and MAILGUN_DOMAIN must be set to send emails."
        )

    from_addr = settings.mailgun_from or f"support@{settings.mailgun_domain}"

    data: dict = {
        "from": from_addr,
        "to": to,
        "subject": subject,
        "text": body,
    }
    if reply_to:
        data["h:Reply-To"] = reply_to

    async with httpx.AsyncClient() as client:
        response = await client.post(
            f"https://api.mailgun.net/v3/{settings.mailgun_domain}/messages",
            auth=("api", settings.mailgun_api_key),
            data=data,
            timeout=10,
        )
        response.raise_for_status()
