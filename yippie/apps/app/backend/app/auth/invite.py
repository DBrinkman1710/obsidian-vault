"""Invite emails — a signed 7-day token links to /register where the invitee
sets their own password. Used by team invites, client onboarding and
superadmin invites; the only path that creates password-less accounts."""
from __future__ import annotations

import html as _html
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
    rbac_role_ids: list[str] | None = None,
) -> None:
    settings = get_settings()
    token = create_signed_token(
        "invite",
        INVITE_TTL,
        email=to.lower().strip(),
        full_name=full_name,
        tenant_id=str(tenant_id),
        role=role,
        rbac_role_ids=rbac_role_ids or [],
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
    first_name = full_name.split()[0] if full_name else full_name
    safe_name = _html.escape(first_name)
    safe_link = _html.escape(magic_link)

    plain_body = (
        f"Hi {first_name},\n\n"
        f"Thank you for requesting a Yippie demo — really appreciate you taking the time.\n\n"
        f"Your workspace is ready. Click the link below to get started (no password needed):\n{magic_link}\n\n"
        f"If you have any questions while exploring, just reply to this email — I read everything.\n\n"
        f"Looking forward to hearing what you think,\n"
        f"Diederik\n"
        f"Founder, Yippie"
    )

    prerendered = (
        f'<p style="margin:0 0 16px;">Hi {safe_name},</p>'
        f'<p style="margin:0 0 16px;">Thank you for requesting a Yippie demo — really appreciate you taking the time.</p>'
        f'<p style="margin:0 0 24px;">Your workspace is ready. Click the button below to get started — no password needed.</p>'
        f'<div style="text-align:center;margin:32px 0;">'
        f'<a href="{safe_link}" style="display:inline-block;background:#5BA4F5;color:#ffffff;'
        f'text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">'
        f'Open your Yippie workspace</a>'
        f'</div>'
        f'<p style="margin:24px 0 16px;">If you have any questions while you\'re exploring, just reply to this email — I read everything.</p>'
        f'<p style="margin:0;">Looking forward to hearing what you think,<br><strong>Diederik</strong><br>'
        f'<span style="color:#6b7280;font-size:13px;">Founder, Yippie</span></p>'
    )

    await send_email(
        to=to,
        subject="Your Yippie workspace is ready",
        body=plain_body,
        html=render_email_html(plain_body, prerendered_html=prerendered, tenant_name="Yippie"),
        from_email="Diederik from Yippie <diederik@getyippie.com>",
        reply_to="diederik@getyippie.com",
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
