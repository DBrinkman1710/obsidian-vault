"""Invite emails — a signed 7-day token links to /register where the invitee
sets their own password. Used by team invites, client onboarding and
superadmin invites; the only path that creates password-less accounts."""
from __future__ import annotations

import uuid
from datetime import timedelta

from app.auth.tokens import create_signed_token
from app.config import get_settings
from app.core.mailer import send_email

INVITE_TTL = timedelta(days=7)


async def send_invite_email(
    to: str,
    full_name: str,
    tenant_id: uuid.UUID,
    role: str,
    tenant_name: str,
) -> None:
    settings = get_settings()
    token = create_signed_token(
        "invite",
        INVITE_TTL,
        email=to.lower().strip(),
        full_name=full_name,
        tenant_id=str(tenant_id),
        role=role,
    )
    link = f"{settings.app_base_url}/register?token={token}"
    body = (
        f"Hi {full_name},\n\n"
        f"You've been invited to {tenant_name} on Yippie.\n\n"
        f"Set your password and activate your account here:\n{link}\n\n"
        f"This link is valid for 7 days. If you weren't expecting this email, you can ignore it."
    )
    await send_email(to=to, subject=f"You're invited to {tenant_name} on Yippie", body=body)
