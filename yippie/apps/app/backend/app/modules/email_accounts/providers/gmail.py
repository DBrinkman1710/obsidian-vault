"""Gmail provider — plain REST via httpx (no google-api-python-client).

Scopes: gmail.send + gmail.readonly (both "restricted" — production use requires
Google's restricted-scope verification; in Testing mode the OAuth app is capped
at 100 test users and refresh tokens expire after 7 days).

Incremental sync uses the history API keyed on historyId; when Google expires
the cursor (404) we fall back to a messages.list query since the last sync and
re-baseline from the profile's current historyId.
"""
from __future__ import annotations

import base64
import logging
import time
from urllib.parse import urlencode

import httpx

from app.config import get_settings
from app.modules.email_accounts.providers.base import (
    EmailProvider,
    ProviderAPIError,
    ProviderAttachment,
    ProviderAuthError,
    ProviderMessage,
    TokenBundle,
)

log = logging.getLogger("yippie.email_accounts.gmail")

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
REVOKE_URL = "https://oauth2.googleapis.com/revoke"
API = "https://gmail.googleapis.com/gmail/v1/users/me"

SCOPES = (
    "openid email "
    "https://www.googleapis.com/auth/gmail.send "
    "https://www.googleapis.com/auth/gmail.readonly"
)
REQUIRED_SCOPES = {
    "https://www.googleapis.com/auth/gmail.send",
    "https://www.googleapis.com/auth/gmail.readonly",
}

MAX_MESSAGES_PER_SYNC = 50
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024  # mirror inbox MAX_STORED_ATTACHMENT_BYTES


def _b64url_decode(data: str) -> bytes:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4))


def _header(headers: list[dict], name: str) -> str | None:
    for h in headers:
        if h.get("name", "").lower() == name.lower():
            return h.get("value")
    return None


class GmailProvider(EmailProvider):
    name = "gmail"

    def is_configured(self) -> bool:
        s = get_settings()
        return bool(s.google_oauth_client_id and s.google_oauth_client_secret)

    def get_authorize_url(self, redirect_uri: str, state: str, login_hint: str | None = None) -> str:
        params = {
            "client_id": get_settings().google_oauth_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": SCOPES,
            # offline + consent → Google returns a refresh token on every link
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        if login_hint:
            params["login_hint"] = login_hint
        return f"{AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> TokenBundle:
        s = get_settings()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(TOKEN_URL, data={
                "client_id": s.google_oauth_client_id,
                "client_secret": s.google_oauth_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
            })
            if resp.status_code != 200:
                raise ProviderAuthError(f"Gmail code exchange failed: {resp.text[:300]}")
            tok = resp.json()
            refresh_token = tok.get("refresh_token")
            if not refresh_token:
                # Happens when a prior grant exists without prompt=consent
                raise ProviderAuthError("Google did not return a refresh token")
            granted = set((tok.get("scope") or "").split())
            if not REQUIRED_SCOPES.issubset(granted):
                raise ProviderAuthError("Required Gmail scopes were not granted")
            # Profile gives the canonical address (and the sync baseline later)
            prof = await client.get(
                f"{API}/profile", headers={"Authorization": f"Bearer {tok['access_token']}"}
            )
            if prof.status_code != 200:
                raise ProviderAPIError(f"Gmail profile fetch failed: {prof.text[:300]}", prof.status_code)
            email = (prof.json().get("emailAddress") or "").lower()
            if not email:
                raise ProviderAPIError("Gmail profile returned no emailAddress")
        return TokenBundle(
            access_token=tok["access_token"],
            refresh_token=refresh_token,
            expires_in=int(tok.get("expires_in", 3600)),
            email=email,
            scopes=tok.get("scope") or SCOPES,
        )

    async def refresh_access_token(self, refresh_token: str) -> tuple[str, int, str | None]:
        s = get_settings()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(TOKEN_URL, data={
                "client_id": s.google_oauth_client_id,
                "client_secret": s.google_oauth_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
            })
        if resp.status_code == 200:
            tok = resp.json()
            # Google keeps the same refresh token — nothing to rotate
            return tok["access_token"], int(tok.get("expires_in", 3600)), None
        if "invalid_grant" in resp.text:
            raise ProviderAuthError("Gmail refresh token revoked or expired")
        raise ProviderAPIError(f"Gmail token refresh failed: {resp.text[:300]}", resp.status_code)

    async def init_sync_state(self, access_token: str) -> dict:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(f"{API}/profile", headers={"Authorization": f"Bearer {access_token}"})
        if resp.status_code != 200:
            raise ProviderAPIError(f"Gmail profile fetch failed: {resp.text[:300]}", resp.status_code)
        return {"history_id": str(resp.json()["historyId"]), "last_epoch": int(time.time())}

    async def list_new_messages(self, access_token: str, sync_state: dict) -> tuple[list[ProviderMessage], dict]:
        headers = {"Authorization": f"Bearer {access_token}"}
        history_id = (sync_state or {}).get("history_id")
        async with httpx.AsyncClient(timeout=60) as client:
            message_ids: list[str] = []
            new_history_id = history_id
            if history_id:
                message_ids, new_history_id, expired = await self._list_via_history(client, headers, history_id)
                if expired:
                    message_ids = await self._list_via_query(
                        client, headers, int((sync_state or {}).get("last_epoch") or time.time())
                    )
                    prof = await client.get(f"{API}/profile", headers=headers)
                    if prof.status_code == 200:
                        new_history_id = str(prof.json()["historyId"])
            else:
                # No cursor at all (legacy row) — re-baseline without backfill
                return [], await self.init_sync_state(access_token)

            messages: list[ProviderMessage] = []
            for mid in message_ids[:MAX_MESSAGES_PER_SYNC]:
                msg = await self._fetch_message(client, headers, mid)
                if msg is not None:
                    messages.append(msg)

        return messages, {"history_id": str(new_history_id), "last_epoch": int(time.time())}

    async def _list_via_history(
        self, client: httpx.AsyncClient, headers: dict, history_id: str
    ) -> tuple[list[str], str, bool]:
        """Returns (message_ids, new_history_id, cursor_expired)."""
        ids: list[str] = []
        new_history_id = history_id
        page_token = None
        while True:
            params = {
                "startHistoryId": history_id,
                "historyTypes": "messageAdded",
                "labelId": "INBOX",
            }
            if page_token:
                params["pageToken"] = page_token
            resp = await client.get(f"{API}/history", headers=headers, params=params)
            if resp.status_code == 404:
                return [], history_id, True  # cursor expired
            if resp.status_code == 429:
                raise ProviderAPIError(
                    "Gmail rate limited", 429,
                    retry_after=float(resp.headers.get("Retry-After", 60)),
                )
            if resp.status_code != 200:
                raise ProviderAPIError(f"Gmail history failed: {resp.text[:300]}", resp.status_code)
            data = resp.json()
            new_history_id = str(data.get("historyId", new_history_id))
            for h in data.get("history", []):
                for added in h.get("messagesAdded", []):
                    m = added.get("message", {})
                    labels = m.get("labelIds", [])
                    if "INBOX" in labels and "SENT" not in labels and "DRAFT" not in labels:
                        ids.append(m["id"])
            page_token = data.get("nextPageToken")
            if not page_token:
                break
        # History can report the same message multiple times — dedupe, keep order
        return list(dict.fromkeys(ids)), new_history_id, False

    async def _list_via_query(self, client: httpx.AsyncClient, headers: dict, after_epoch: int) -> list[str]:
        resp = await client.get(f"{API}/messages", headers=headers, params={
            "q": f"in:inbox after:{after_epoch}",
            "maxResults": MAX_MESSAGES_PER_SYNC,
        })
        if resp.status_code != 200:
            raise ProviderAPIError(f"Gmail messages.list failed: {resp.text[:300]}", resp.status_code)
        return [m["id"] for m in resp.json().get("messages", [])]

    async def _fetch_message(self, client: httpx.AsyncClient, headers: dict, mid: str) -> ProviderMessage | None:
        resp = await client.get(f"{API}/messages/{mid}", headers=headers, params={"format": "full"})
        if resp.status_code != 200:
            log.warning("Gmail messages.get %s → HTTP %s", mid, resp.status_code)
            return None
        data = resp.json()
        payload = data.get("payload", {})
        hdrs = payload.get("headers", [])

        text_parts: list[str] = []
        html_parts: list[str] = []
        attachments: list[ProviderAttachment] = []

        async def walk(part: dict) -> None:
            mime_type = part.get("mimeType", "")
            body = part.get("body", {})
            filename = part.get("filename")
            if filename and body.get("attachmentId"):
                if int(body.get("size", 0)) <= MAX_ATTACHMENT_BYTES:
                    att = await client.get(
                        f"{API}/messages/{mid}/attachments/{body['attachmentId']}", headers=headers
                    )
                    if att.status_code == 200:
                        attachments.append(ProviderAttachment(
                            filename=filename,
                            content_type=mime_type or "application/octet-stream",
                            content_b64=base64.b64encode(_b64url_decode(att.json()["data"])).decode(),
                        ))
            elif mime_type == "text/plain" and body.get("data"):
                text_parts.append(_b64url_decode(body["data"]).decode("utf-8", errors="replace"))
            elif mime_type == "text/html" and body.get("data"):
                html_parts.append(_b64url_decode(body["data"]).decode("utf-8", errors="replace"))
            for sub in part.get("parts", []):
                await walk(sub)

        await walk(payload)

        from_header = _header(hdrs, "From") or ""
        sender_name, sender_email = _parse_from(from_header)
        return ProviderMessage(
            provider_message_id=data["id"],
            smtp_message_id=_header(hdrs, "Message-ID"),
            thread_ref=data.get("threadId"),
            sender=sender_email,
            sender_name=sender_name,
            subject=_header(hdrs, "Subject"),
            body_text="\n".join(text_parts).strip() or None,
            body_html="\n".join(html_parts).strip() or None,
            received_at=None,  # internalDate is epoch ms; sync layer uses now()
            in_reply_to=_header(hdrs, "In-Reply-To"),
            references_header=_header(hdrs, "References"),
            raw_headers={h["name"]: h["value"] for h in hdrs if h.get("name")},
            attachments=attachments,
        )

    async def send_message(self, access_token: str, mime_bytes: bytes, thread_ref: str | None = None) -> str:
        body: dict = {"raw": base64.urlsafe_b64encode(mime_bytes).decode()}
        if thread_ref:
            body["threadId"] = thread_ref
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{API}/messages/send",
                headers={"Authorization": f"Bearer {access_token}"},
                json=body,
            )
        if resp.status_code == 401:
            raise ProviderAuthError("Gmail send unauthorized")
        if resp.status_code == 429:
            raise ProviderAPIError("Gmail rate limited", 429, retry_after=float(resp.headers.get("Retry-After", 60)))
        if resp.status_code not in (200, 202):
            raise ProviderAPIError(f"Gmail send failed: {resp.text[:300]}", resp.status_code)
        return resp.json().get("id", "")

    async def revoke(self, refresh_token: str) -> None:
        try:
            async with httpx.AsyncClient(timeout=15) as client:
                await client.post(REVOKE_URL, params={"token": refresh_token})
        except httpx.HTTPError as exc:  # best-effort
            log.warning("Gmail revoke failed: %s", exc)


def _parse_from(value: str) -> tuple[str | None, str]:
    """'Jan de Vries <jan@acme.nl>' → ('Jan de Vries', 'jan@acme.nl')."""
    from email.utils import parseaddr

    name, addr = parseaddr(value)
    return (name or None), addr.lower()
