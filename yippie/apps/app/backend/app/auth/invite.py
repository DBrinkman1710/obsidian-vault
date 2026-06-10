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
    admin_section = (
        "As an admin you can also:\n"
        "  - Invite your team from Settings -> Team — every teammate gets their own login\n"
        "  - Manage departments and follow-up times from Settings -> Departments\n\n"
    ) if role in ("admin", "superadmin") else ""
    body = (
        f"Hi {full_name},\n\n"
        f"Welcome to Yippie! You've been invited to {tenant_name}.\n\n"
        f"Step 1 — activate your account\n"
        f"Set your password here (the link is valid for 7 days):\n{link}\n\n"
        f"Step 2 — set up your email\n"
        f"Yippie turns your support mail into tickets automatically. Once you're logged in:\n"
        f"  - Your team's shared support address is already connected — new mail appears in Inbox\n"
        f"  - Want your own address too? Go to Settings -> Profile and set a personal email\n"
        f"    address. Mail sent to it lands in your Personal inbox, and you can send from it\n"
        f"    when replying or composing\n\n"
        f"Step 3 — take a look around\n"
        f"  - Inbox: review the tickets Yippie drafts from incoming mail — approve, edit or reject\n"
        f"  - Contacts: your customers, with history and AI briefings\n"
        f"  - Tickets: everything your team is working on, with deadlines\n\n"
        f"{admin_section}"
        f"Questions? Just reply to this email — a real person reads it.\n\n"
        f"Take back the time that matters,\n"
        f"Team Yippie\n\n"
        f"If you weren't expecting this email, you can safely ignore it."
    )
    await send_email(to=to, subject=f"Welcome to Yippie — your {tenant_name} account is ready", body=body)
