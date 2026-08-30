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
from app.core.email_i18n import EMAILS, pick
from app.core.mailer import send_email

INVITE_TTL = timedelta(days=7)


async def send_invite_email(
    to: str,
    full_name: str,
    tenant_id: uuid.UUID,
    role: str,
    tenant_name: str,
    rbac_role_ids: list[str] | None = None,
    lang: str = "nl",
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
    base = settings.client_base_url or settings.effective_base_url
    link = f"{base}/register?token={token}"
    # Short form on purpose (Diederik, 2026-06-10): just the activation link. The
    # product introduction is a separate mail sent into the client's Yippie inbox
    # on tenant creation — see send_welcome_to_inbox().
    t = EMAILS["invite"][pick(lang)]
    body = (
        f"{t['greeting'].format(full_name=full_name)}\n\n"
        f"{t['line1'].format(tenant_name=tenant_name)}\n\n"
        f"{t['line2']}\n{link}\n\n"
        f"{t['footer']}\n\n"
        f"{t['ignore']}"
    )
    await send_email(
        to=to,
        subject=t["subject"].format(tenant_name=tenant_name),
        body=body,
        html=render_email_html(body, tenant_name="Yippie"),
    )


async def send_demo_ready_email(to: str, full_name: str, magic_link: str, lang: str = "nl") -> None:
    first_name = full_name.split()[0] if full_name else full_name
    safe_name = _html.escape(first_name)
    safe_link = _html.escape(magic_link)

    t = EMAILS["demo_ready"][pick(lang)]

    plain_body = (
        f"{t['greeting'].format(first_name=first_name)}\n\n"
        f"{t['line1']}\n\n"
        f"{t['line2']}\n{magic_link}\n\n"
        f"{t['line3']}\n\n"
        f"{t['sign_off']}\n"
        f"{t['signature']}\n"
        f"{t['title']}"
    )

    prerendered = (
        f'<p style="margin:0 0 16px;">{_html.escape(t["greeting"].format(first_name=safe_name))}</p>'
        f'<p style="margin:0 0 16px;">{_html.escape(t["line1"])}</p>'
        f'<p style="margin:0 0 24px;">{_html.escape(t["line2_html"])}</p>'
        f'<div style="text-align:center;margin:32px 0;">'
        f'<a href="{safe_link}" style="display:inline-block;background:#5BA4F5;color:#ffffff;'
        f'text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">'
        f'{_html.escape(t["btn_label"])}</a>'
        f'</div>'
        f'<p style="margin:24px 0 16px;">{_html.escape(t["line3"])}</p>'
        f'<p style="margin:0;">{_html.escape(t["sign_off"])}<br><strong>{_html.escape(t["signature"])}</strong><br>'
        f'<span style="color:#6b7280;font-size:13px;">{_html.escape(t["title"])}</span></p>'
    )

    await send_email(
        to=to,
        subject=t["subject"],
        body=plain_body,
        html=render_email_html(plain_body, prerendered_html=prerendered, tenant_name="Yippie"),
        from_email="Diederik from Yippie <diederik@getyippie.com>",
        reply_to="diederik@getyippie.com",
    )


async def send_verification_email(
    to: str,
    full_name: str,
    verify_url: str,
    auto_password: bool = False,
    lang: str = "nl",
) -> None:
    """Self-serve trial entry link — one click activates the account, logs the
    user in, and lands them in their workspace (demo magic-link UX). The signed
    JWT is valid for 48 hours; afterwards they log in with email + password.
    auto_password: the form had no password field, so the user picks one inside
    the workspace — the "password you chose" line would be wrong."""
    first_name = full_name.split()[0] if full_name else full_name
    safe_name = _html.escape(first_name)
    safe_link = _html.escape(verify_url)

    t = EMAILS["verification"][pick(lang)]
    after_line = t["after_auto"] if auto_password else t["after_normal"]

    plain_body = (
        f"{t['greeting'].format(first_name=first_name)}\n\n"
        f"{t['line1']}\n{verify_url}\n\n"
        f"{t['line2']}\n\n"
        f"{t['line3_template'].format(after_line=after_line)}\n\n"
        f"{t['ignore']}\n\n"
        f"{t['signature']}\n"
        f"{t['title']}"
    )

    prerendered = (
        f'<p style="margin:0 0 16px;">{_html.escape(t["greeting"].format(first_name=safe_name))}</p>'
        f'<p style="margin:0 0 24px;">{_html.escape(t["html_intro"])}</p>'
        f'<div style="text-align:center;margin:32px 0;">'
        f'<a href="{safe_link}" style="display:inline-block;background:#5BA4F5;color:#ffffff;'
        f'text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;font-size:15px;">'
        f'{_html.escape(t["btn_label"])}</a>'
        f'</div>'
        f'<p style="margin:24px 0 16px;color:#6b7280;font-size:13px;">'
        f'{_html.escape(t["line3_template"].format(after_line=after_line))}</p>'
        f'<p style="margin:0 0 16px;color:#6b7280;font-size:13px;">{_html.escape(t["ignore"])}</p>'
        f'<p style="margin:0;"><strong>{_html.escape(t["signature"])}</strong><br>'
        f'<span style="color:#6b7280;font-size:13px;">{_html.escape(t["title"])}</span></p>'
    )

    await send_email(
        to=to,
        subject=t["subject"],
        body=plain_body,
        html=render_email_html(plain_body, prerendered_html=prerendered, tenant_name="Yippie"),
        from_email="Diederik from Yippie <diederik@getyippie.com>",
        reply_to="diederik@getyippie.com",
    )


async def send_welcome_to_inbox(tenant_inbound_email: str, tenant_name: str, lang: str = "nl") -> None:
    """Send the welcome/introduction mail INTO the client's Yippie inbox (their
    tenant inbound address), so it's the first item they see in the product
    instead of being buried in the password mail."""
    t = EMAILS["welcome_inbox"][pick(lang)]
    body = (
        f"{t['greeting'].format(tenant_name=tenant_name)}\n\n"
        f"{t['intro']}\n\n"
        f"{t['getting_started_header']}\n"
        f"{t['getting_started']}\n\n"
        f"{t['setup_header']}\n"
        f"{t['setup']}\n\n"
        f"{t['admin_header']}\n"
        f"{t['admin']}\n\n"
        f"{t['closing']}\n\n"
        f"{t['sign_off']}\n"
        f"{t['footer']}"
    )
    await send_email(
        to=tenant_inbound_email,
        subject=t["subject"],
        body=body,
        html=render_email_html(body, tenant_name="Yippie"),
    )
