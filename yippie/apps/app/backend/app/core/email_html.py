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


def _safe_hex(color: object, default: str) -> str:
    color = str(color or "").strip()
    return color if _HEX_RE.match(color) else default


def _safe_int(value: object, default: int) -> int:
    try:
        return int(value)  # type: ignore[arg-type]
    except (TypeError, ValueError):
        return default


_URL_RE = re.compile(r"(https?://[^\s<]+)")

# Signature images (S2) are embedded in the plain-text body as a single inline
# <img src="data:image/...;base64,..."> tag. The body is otherwise escaped for
# safety, so we extract these strictly-validated tags first, escape everything
# else, then re-insert the tags. Only data-URI sources for svg/png/jpeg are
# allowed — no remote URLs, no other attributes, no script vectors.
_SIG_IMG_RE = re.compile(
    r'<img\s+src="(data:image/(?:svg\+xml|png|jpeg|jpg);base64,[A-Za-z0-9+/=\s]+)"'
    r'(?:\s+[a-z-]+="[^"<>]*")*\s*/?>',
    re.IGNORECASE,
)


def _paragraphs(text: str) -> str:
    """Escape and convert plain text to <p> blocks (blank line = new paragraph).
    URLs become clickable links (matters for invite/reset mails). Inline
    base64-image <img> tags (signature images, S2) are preserved verbatim
    instead of being escaped."""
    text = text.strip()

    # Pull out allowlisted inline-image tags so html.escape() doesn't mangle
    # them, replacing each with a placeholder we restore after escaping.
    images: list[str] = []

    def _stash(m: re.Match) -> str:
        src = m.group(1)
        images.append(
            f'<img src="{src}" style="max-width:100%;height:auto;border:0;" />'
        )
        return f"\x00IMG{len(images) - 1}\x00"

    stashed = _SIG_IMG_RE.sub(_stash, text)

    escaped = html.escape(stashed)
    escaped = _URL_RE.sub(
        r'<a href="\1" style="color:#2563eb;word-break:break-all;">\1</a>', escaped
    )
    parts = [p.strip().replace("\n", "<br>") for p in re.split(r"\n\s*\n", escaped) if p.strip()]
    rendered = "".join(
        f'<p style="margin:0 0 14px 0;line-height:1.55;">{p}</p>' for p in parts
    )
    # Restore the safe image tags (placeholders survive html.escape untouched).
    for i, img in enumerate(images):
        rendered = rendered.replace(f"\x00IMG{i}\x00", img)
    return rendered


def render_campaign_buttons_html(buttons: list[dict], token_map: dict[str, str] | None = None) -> str:
    """Render campaign buttons as HTML.

    ``token_map`` maps button id → full tracking URL
    (``{base_url}/api/v1/track/click/{token}``). Buttons without a token render
    with a placeholder href."""
    if not buttons:
        return ""
    links = []
    for b in buttons:
        text = html.escape(str(b.get("text") or ""))
        if not text:
            continue
        bg = _safe_hex(b.get("bg_color"), "#5BA4F5")
        color = _safe_hex(b.get("text_color"), "#ffffff")
        radius = _safe_int(b.get("border_radius"), 6)
        font_size = _safe_int(b.get("font_size"), 14)
        font_weight = html.escape(str(b.get("font_weight") or "600"))
        border_width = _safe_int(b.get("border_width"), 0)
        border_color = b.get("border_color")
        border = (
            f"border:{border_width}px solid {_safe_hex(border_color, '#5BA4F5')};"
            if border_width > 0 and border_color
            else ""
        )
        href = token_map.get(str(b.get("id", "")), "#") if token_map else "#"
        href = html.escape(href, quote=True)
        links.append(
            f'<a href="{href}" style="display:inline-block;padding:10px 22px;'
            f"margin:6px 8px 6px 0;background:{bg};color:{color};"
            f"border-radius:{radius}px;font-size:{font_size}px;"
            f'font-weight:{font_weight};text-decoration:none;{border}">{text}</a>'
        )
    if not links:
        return ""
    return f'<div style="padding:8px 0;text-align:center;">{"".join(links)}</div>'


def inject_button_tracking(html_content: str, buttons: list[dict], token_map: dict[str, str]) -> str:
    """Replace hrefs in Unlayer-exported HTML for tracked buttons.

    Matches <a> elements by their visible text (case-insensitive, stripped of whitespace)
    against campaign button texts, then substitutes the tracking URL from token_map.
    Uses a simple regex approach to avoid adding dependencies.
    """
    if not buttons or not token_map:
        return html_content

    def _norm(s: str) -> str:
        # Unlayer wraps button labels in spans and pads them with &nbsp;, so the
        # visible text is e.g. "&nbsp;&nbsp;Interested&nbsp;&nbsp;" across nested
        # tags. Decode entities (&nbsp; → \xa0) and collapse all whitespace —
        # including the non-breaking \xa0 — so it matches the plain button text.
        return re.sub(r"\s+", " ", html.unescape(s)).strip().lower()

    # Build text (entity-decoded, whitespace-collapsed, lowercased) → tracking_url
    text_to_url: dict[str, str] = {}
    for btn in buttons:
        btn_id = str(btn.get("id", ""))
        url = token_map.get(btn_id)
        text = _norm(btn.get("text") or "")
        if url and text:
            text_to_url[text] = url

    if not text_to_url:
        return html_content

    # Match <a ...>...</a> blocks and replace href if link text matches
    # Pattern captures: group1=opening tag with href, group2=href value, group3=rest of tag, group4=inner content
    pattern = re.compile(
        r'(<a\b[^>]*\bhref=")([^"]*)(\"[^>]*>)(.*?)(</a>)',
        re.DOTALL | re.IGNORECASE,
    )

    def replacer(m: re.Match) -> str:
        inner = _norm(re.sub(r'<[^>]+>', '', m.group(4)))
        if inner in text_to_url:
            return m.group(1) + html.escape(text_to_url[inner], quote=True) + m.group(3) + m.group(4) + m.group(5)
        return m.group(0)

    return pattern.sub(replacer, html_content)


def render_email_html(
    body_text: str,
    tenant_name: str | None = None,
    primary_color: str | None = None,
    prerendered_html: str | None = None,
    campaign_buttons_html: str = "",
) -> str:
    """Render the plain-text body into the standard Yippie HTML layout.

    When ``prerendered_html`` is set (Unlayer template export), it is embedded
    directly in the white card instead of paragraph-escaping ``body_text``.
    ``campaign_buttons_html`` (Phase 9C tracked buttons) is injected after the
    content block, inside the white card."""
    accent = _safe_color(primary_color)
    content = prerendered_html if prerendered_html is not None else _paragraphs(body_text)
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
        f'<div style="padding:24px;">{content}</div>'
        f"{campaign_buttons_html}"
        "</div>"
        '<div style="text-align:center;padding:16px 0;font-size:12px;color:#9ca3af;">'
        "Sent with Yippie</div>"
        "</div></body></html>"
    )
