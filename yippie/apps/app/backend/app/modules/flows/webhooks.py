"""[FLOW5] Webhook plumbing — inbound payload flattening + outbound delivery.

Two directions:
  - Inbound: ``flatten_payload`` turns an arriving JSON body into the flat event
    ``fields`` dict the condition evaluator understands (top-level keys only).
  - Outbound: ``deliver`` POSTs a signed JSON body to a tenant-configured URL
    behind an SSRF guard. The guard resolves the host ONCE, rejects any private/
    loopback/link-local address, and then pins the connection to that resolved
    IP (presenting the original host for the Host header + TLS SNI). Pinning is
    the important half: validating a hostname and then letting the HTTP client
    re-resolve it is open to DNS rebinding (a TOCTOU where the second lookup
    returns 169.254.169.254). Cert verification still happens against the real
    hostname, so ordinary HTTPS webhooks keep working.

Pure helpers (``flatten_payload``, ``sign_payload``, ``resolve_public_ip``) are
DB-free and unit-tested; ``deliver`` does the actual network I/O.
"""
from __future__ import annotations

import hashlib
import hmac
import ipaddress
import json
import socket
from typing import Any

import httpx

# A webhook body may not exceed 64KB (matches the inbound handler's read cap).
MAX_PAYLOAD_BYTES = 64 * 1024
# Outbound requests get a tight timeout — a slow receiver must not tie up the
# engine tick. Failures ride the [FLOW2A] retry ladder.
OUTBOUND_TIMEOUT = 5.0
ALLOWED_SCHEMES = ("http", "https")
SIGNATURE_HEADER = "X-Yippie-Signature"


class WebhookError(Exception):
    """A permanent delivery failure (bad URL, blocked address). Recorded as a
    hard failure — retrying can't fix it, so the executor does NOT re-raise it
    into the engine's retry ladder."""


def flatten_payload(body: Any, cap: int = 40) -> dict:
    """The event ``fields`` an inbound webhook contributes: the body's top-level
    keys, keeping only JSON scalars and lists (nested objects are dropped — the
    condition evaluator only reasons about flat values). At most ``cap`` keys."""
    if not isinstance(body, dict):
        return {}
    fields: dict = {}
    for key, value in body.items():
        if len(fields) >= cap:
            break
        if not isinstance(key, str):
            continue
        if isinstance(value, (str, int, float, bool)) or value is None:
            fields[str(key)] = value
        elif isinstance(value, list):
            # keep flat lists of scalars (used by contains/in); drop nested lists
            if all(isinstance(v, (str, int, float, bool)) or v is None for v in value):
                fields[str(key)] = value
    return fields


def sign_payload(secret: str, body: bytes) -> str:
    """The HMAC-SHA256 signature receivers verify, formatted ``sha256=<hex>``
    (the GitHub/Stripe convention)."""
    digest = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return f"sha256={digest}"


def _is_blocked_ip(ip: str) -> bool:
    """Reject anything that isn't a routable public address — loopback, private
    ranges (RFC1918 + fc00::/7), link-local (incl. the 169.254.169.254 cloud
    metadata endpoint), reserved, multicast and the unspecified address."""
    try:
        addr = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return (
        addr.is_private
        or addr.is_loopback
        or addr.is_link_local
        or addr.is_multicast
        or addr.is_reserved
        or addr.is_unspecified
    )


def resolve_public_ip(host: str, port: int) -> str:
    """Resolve ``host`` and return a single validated public IP to pin the
    connection to. Rejects the request if resolution fails or ANY resolved
    address is non-public (a hostname with even one private record can't be
    trusted). Raises WebhookError."""
    try:
        infos = socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)
    except socket.gaierror:
        raise WebhookError(f"Could not resolve host '{host}'")
    ips = {info[4][0] for info in infos}
    if not ips:
        raise WebhookError(f"Could not resolve host '{host}'")
    for ip in ips:
        if _is_blocked_ip(ip):
            raise WebhookError("The webhook URL resolves to a private or reserved address")
    return sorted(ips)[0]


def _pinned_url(url: httpx.URL, ip: str) -> httpx.URL:
    # copy_with brackets IPv6 literals for us; the port (explicit or scheme
    # default) is preserved on the URL.
    return url.copy_with(host=ip)


def validate_target(raw_url: str) -> tuple[httpx.URL, str, str]:
    """Parse + SSRF-check a target URL. Returns (url, host, pinned_ip). Raises
    WebhookError on a bad scheme, missing host, or a blocked address."""
    try:
        url = httpx.URL(raw_url)
    except Exception:
        raise WebhookError("Invalid webhook URL")
    if url.scheme not in ALLOWED_SCHEMES:
        raise WebhookError("A webhook URL must be http or https")
    host = url.host
    if not host:
        raise WebhookError("The webhook URL has no host")
    port = url.port or (443 if url.scheme == "https" else 80)
    pinned_ip = resolve_public_ip(host, port)
    return url, host, pinned_ip


class _PinnedTransport(httpx.AsyncHTTPTransport):
    """Force every request onto the pre-validated IP while presenting the real
    host for the Host header and TLS SNI — so the connection can't be re-pointed
    at a private address by a second DNS lookup (rebinding)."""

    def __init__(self, host: str, ip: str, **kwargs):
        super().__init__(**kwargs)
        self._host = host
        self._ip = ip

    async def handle_async_request(self, request: httpx.Request) -> httpx.Response:
        request.url = _pinned_url(request.url, self._ip)
        request.headers["Host"] = self._host
        request.extensions = {**request.extensions, "sni_hostname": self._host}
        return await super().handle_async_request(request)


async def deliver(raw_url: str, payload: dict, secret: str) -> int:
    """POST ``payload`` as signed JSON to ``raw_url`` behind the SSRF guard.

    Returns the HTTP status on a 2xx. Raises WebhookError for a permanent problem
    (bad/blocked URL — no point retrying) and httpx.HTTPError / a non-2xx-raised
    error for a transient one (receiver down/slow — the retry ladder catches it).
    """
    url, host, pinned_ip = validate_target(raw_url)
    body = json.dumps(payload, separators=(",", ":"), default=str).encode()
    headers = {
        "Content-Type": "application/json",
        SIGNATURE_HEADER: sign_payload(secret, body),
        "User-Agent": "Yippie-Flows/1.0",
    }
    transport = _PinnedTransport(host, pinned_ip, retries=0)
    async with httpx.AsyncClient(
        transport=transport, timeout=OUTBOUND_TIMEOUT, follow_redirects=False
    ) as client:
        response = await client.request("POST", url, content=body, headers=headers)
    if response.status_code >= 400:
        # Transient from our side: the receiver may recover, so let it retry.
        raise httpx.HTTPStatusError(
            f"Webhook returned {response.status_code}", request=response.request, response=response
        )
    return response.status_code
