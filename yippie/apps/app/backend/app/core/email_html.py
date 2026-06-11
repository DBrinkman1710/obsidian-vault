"""Minimal HTML layout for outbound email (item 46).

Wraps the plain-text body in a deliverability-safe, inline-styled HTML shell:
a thin accent bar + sender name header, paragraphs, and a small footer. The
plain text is always sent alongside as the text part (mailer keeps "text"),
so clients that prefer plain text lose nothing.

No template engine on purpose — one f-string keeps this dependency-free and
is enough until the Phase 9 template system lands.
"""
from __future__ import annotations

import html
import re

DEFAULT_ACCENT = "#5BB8E8"  # Yippie default (Tenant.primary_color default)

_HEX_RE = re.compile(r"^#[0-9a-fA-F]{3,8}$")


def _safe_color(color: str | None) -> str:
    color = (color or "").strip()
    return color if _HEX_RE.match(color) else DEFAULT_ACCENT


_URL_RE = re.compile(r"(https?://[^\s<]+)")


def _paragraphs(text: str) -> str:
    """Escape and convert plain text to <p> blocks (blank line = new paragraph).
    URLs become clickable links (matters for invite/reset mails)."""
    escaped = html.escape(text.strip())
    escaped = _URL_RE.sub(
        r'<a href="\1" style="color:#2563eb;word-break:break-all;">\1</a>', escaped
    )
    parts = [p.strip().replace("\n", "<br>") for p in re.split(r"\n\s*\n", escaped) if p.strip()]
    return "".join(
        f'<p style="margin:0 0 14px 0;line-height:1.55;">{p}</p>' for p in parts
    )


def render_email_html(
    body_text: str,
    tenant_name: str | None = None,
    primary_color: str | None = None,
) -> str:
    """Render the plain-text body into the standard Yippie HTML layout."""
    accent = _safe_color(primary_color)
    header = (
        f'<div style="font-size:14px;font-weight:600;color:#374151;'
        f'padding:14px 24px;border-bottom:1px solid #e5e7eb;">{html.escape(tenant_name)}</div>'
        if tenant_name
        else ""
    )
    return (
        '<!DOCTYPE html>'
        '<html><body style="margin:0;padding:0;background:#f3f4f6;">'
        '<div style="max-width:600px;margin:0 auto;padding:24px 12px;'
        "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;"
        'font-size:15px;color:#1f2937;">'
        '<div style="background:#ffffff;border-radius:8px;overflow:hidden;'
        'border:1px solid #e5e7eb;">'
        f'<div style="height:4px;background:{accent};"></div>'
        f"{header}"
        f'<div style="padding:24px;">{_paragraphs(body_text)}</div>'
        "</div>"
        '<div style="text-align:center;padding:16px 0;font-size:12px;color:#9ca3af;">'
        "Sent with Yippie</div>"
        "</div></body></html>"
    )
