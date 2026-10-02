"""Client metadata + bot detection for email tracking (clicks and opens).

Captures the real client IP and user-agent behind Cloudflare -> Railway, and
flags obvious non-human traffic. Deliberately conservative: it targets security
scanners and raw HTTP libraries, NOT Gmail/Apple image proxies — Apple Mail
Privacy Protection and Gmail prefetch need IP-range handling, which is a
separate (and heavier) problem. The behavioural signal (multiple buttons,
sub-second timing) still complements this.
"""
from __future__ import annotations

import re

from fastapi import Request

# Known non-human user agents: security gateways + raw HTTP clients + crawlers.
_BOT_UA = re.compile(
    r"(bot|crawl|spider|scan|proofpoint|mimecast|barracuda|forcepoint|ironport|"
    r"cisco|symantec|messagelabs|fireeye|trendmicro|curl|wget|python-requests|"
    r"go-http-client|java/|okhttp|axios|libwww|httpclient|headless|phantom)",
    re.IGNORECASE,
)


def get_client_ip(request: Request) -> str | None:
    """Real client IP. Behind Cloudflare the trustworthy value is
    CF-Connecting-IP (see the login rate-limit fix); fall back to the first
    X-Forwarded-For hop, then the direct peer."""
    ip = request.headers.get("cf-connecting-ip")
    if ip:
        return ip.strip()[:64]
    xff = request.headers.get("x-forwarded-for")
    if xff:
        return xff.split(",")[0].strip()[:64] or None
    return request.client.host if request.client else None


def is_bot_user_agent(ua: str | None) -> bool:
    """True when the user-agent is a clear non-human. Empty/absent UA counts as
    automation — a real mail client or browser always sends one."""
    if not ua or not ua.strip():
        return True
    return bool(_BOT_UA.search(ua))
