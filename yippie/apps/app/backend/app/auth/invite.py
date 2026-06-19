"""Invite emails — a signed 7-day token links to /register where the invitee
sets their own password. Used by team invites, client onboarding and
superadmin invites; the only path that creates password-less accounts."""
from __future__ import annotations

import uuid
from datetime import timedelta

from app.auth.tokens import create_signed_token
from app.config import get_settings
from app.core.email_html import render_email_html
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
    base = settings.client_base_url or settings.app_base_url
    link = f"{base}/register?token={token}"
    # Short form on purpose (Diederik, 2026-06-10): just the activation link. The
    # product introduction is a separate mail sent into the client's Yippie inbox
    # on tenant creation — see send_welcome_to_inbox().
    body = (
        f"Hi {full_name},\n\n"
        f"You've been invited to {tenant_name} on Yippie.\n\n"
        f"Set your password here (the link is valid for 7 days):\n{link}\n\n"
        f"Team Yippie\n\n"
        f"If you weren't expecting this email, you can safely ignore it."
    )
    await send_email(
        to=to,
        subject=f"Set your password — your {tenant_name} account on Yippie",
        body=body,
        html=render_email_html(body, tenant_name="Yippie"),
    )


async def send_demo_ready_email(to: str, full_name: str, magic_link: str) -> None:
    body = (
        f"Hi {full_name},\n\n"
        f"Demo sent.\n\n"
        f"Enter your demo workspace here (one click, no password needed):\n{magic_link}\n\n"
        f"Team Yippie"
    )
    await send_email(
        to=to,
        subject="Your Yippie demo",
        body=body,
        html=render_email_html(body, tenant_name="Yippie"),
    )


async def send_welcome_to_inbox(tenant_inbound_email: str, tenant_name: str) -> None:
    """Send the welcome/introduction mail INTO the client's Yippie inbox (their
    tenant inbound address), so it's the first item they see in the product
    instead of being buried in the password mail."""
    body = (
        f"Hi {tenant_name},\n\n"
        f"Welcome to Yippie! This is your inbox — every email your customers send to your\n"
        f"support address lands here, and Yippie drafts a ticket for each one automatically.\n\n"
        f"Getting started:\n"
        f"  - Inbox: review the tickets Yippie drafts from incoming mail — approve, edit or reject\n"
        f"  - Contacts: your customers, with history and AI briefings\n"
        f"  - Tickets: everything your team is working on, with deadlines\n\n"
        f"Set up your email:\n"
        f"  - Your team's shared support address is already connected — new mail appears in Inbox\n"
        f"  - Want your own address too? Go to Settings -> Profile and set a personal email\n"
        f"    address. Mail sent to it lands in your Personal inbox, and you can send from it\n"
        f"    when replying or composing\n\n"
        f"As an admin you can also:\n"
        f"  - Invite your team from Settings -> Team — every teammate gets their own login\n"
        f"  - Manage departments and follow-up times from Settings -> Departments\n\n"
        f"Questions? Just reply to this email — a real person reads it.\n\n"
        f"Take back the time that matters,\n"
        f"Team Yippie"
    )
    await send_email(
        to=tenant_inbound_email,
        subject="Welcome to Yippie 👋",
        body=body,
        html=render_email_html(body, tenant_name="Yippie"),
    )
