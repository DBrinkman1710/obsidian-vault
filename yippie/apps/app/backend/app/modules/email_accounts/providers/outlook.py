"""Outlook / Microsoft 365 provider — Microsoft Graph via httpx.

Uses the /common endpoint so both organizational (M365) and personal Microsoft
accounts can link. Incremental sync uses the inbox delta query (deltaLink
cursor). IMPORTANT: Graph rotates the refresh token on every refresh — the
rotated token is always returned to the caller for persistence.

Sending posts raw base64 MIME to /me/sendMail (Content-Type: text/plain), which
allows arbitrary threading headers — the JSON payload would restrict custom
headers to x- prefixes.

There is no delegated-token revoke endpoint; users revoke Yippie's access at
account.microsoft.com → Privacy → Apps and services.
"""
from __future__ import annotations

import base64
import logging
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

log = logging.getLogger("yippie.email_accounts.outlook")

AUTH_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize"
TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token"
GRAPH = "https://graph.microsoft.com/v1.0"

SCOPES = "openid email offline_access https://graph.microsoft.com/Mail.Read https://graph.microsoft.com/Mail.Send"
REQUIRED_SCOPES = {"Mail.Read", "Mail.Send"}

MAX_MESSAGES_PER_SYNC = 50
MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024

DELTA_SELECT = "internetMessageId,conversationId,subject,from,receivedDateTime,body,internetMessageHeaders,hasAttachments"


class OutlookProvider(EmailProvider):
    name = "outlook"

    def is_configured(self) -> bool:
        s = get_settings()
        return bool(s.ms_oauth_client_id and s.ms_oauth_client_secret)

    def get_authorize_url(self, redirect_uri: str, state: str, login_hint: str | None = None) -> str:
        params = {
            "client_id": get_settings().ms_oauth_client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "response_mode": "query",
            "scope": SCOPES,
            "state": state,
        }
        if login_hint:
            params["login_hint"] = login_hint
        return f"{AUTH_URL}?{urlencode(params)}"

    async def exchange_code(self, code: str, redirect_uri: str) -> TokenBundle:
        s = get_settings()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(TOKEN_URL, data={
                "client_id": s.ms_oauth_client_id,
                "client_secret": s.ms_oauth_client_secret,
                "code": code,
                "grant_type": "authorization_code",
                "redirect_uri": redirect_uri,
                "scope": SCOPES,
            })
            if resp.status_code != 200:
                raise ProviderAuthError(f"Outlook code exchange failed: {resp.text[:300]}")
            tok = resp.json()
            if not tok.get("refresh_token"):
                raise ProviderAuthError("Microsoft did not return a refresh token (offline_access missing?)")
            granted_raw = tok.get("scope") or ""
            granted = {sc.rsplit("/", 1)[-1] for sc in granted_raw.split()}
            if not REQUIRED_SCOPES.issubset(granted):
                raise ProviderAuthError("Required Outlook scopes were not granted")
            me = await client.get(
                f"{GRAPH}/me", headers={"Authorization": f"Bearer {tok['access_token']}"}
            )
            if me.status_code != 200:
                raise ProviderAPIError(f"Graph /me failed: {me.text[:300]}", me.status_code)
            data = me.json()
            email = (data.get("mail") or data.get("userPrincipalName") or "").lower()
            if not email or "#ext#" in email:
                raise ProviderAPIError("Could not determine the account's email address")
        return TokenBundle(
            access_token=tok["access_token"],
            refresh_token=tok["refresh_token"],
            expires_in=int(tok.get("expires_in", 3600)),
            email=email,
            scopes=granted_raw or SCOPES,
            display_name=data.get("displayName"),
        )

    async def refresh_access_token(self, refresh_token: str) -> tuple[str, int, str | None]:
        s = get_settings()
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(TOKEN_URL, data={
                "client_id": s.ms_oauth_client_id,
                "client_secret": s.ms_oauth_client_secret,
                "refresh_token": refresh_token,
                "grant_type": "refresh_token",
                "scope": SCOPES,
            })
        if resp.status_code == 200:
            tok = resp.json()
            # Graph rotates refresh tokens — caller must persist the new one
            return tok["access_token"], int(tok.get("expires_in", 3600)), tok.get("refresh_token")
        if "invalid_grant" in resp.text:
            raise ProviderAuthError("Outlook refresh token revoked or expired")
        raise ProviderAPIError(f"Outlook token refresh failed: {resp.text[:300]}", resp.status_code)

    async def init_sync_state(self, access_token: str) -> dict:
        """Drain the initial delta to its deltaLink WITHOUT ingesting (no backfill)."""
        headers = {"Authorization": f"Bearer {access_token}"}
        url = f"{GRAPH}/me/mailFolders/inbox/messages/delta?$select=internetMessageId"
        async with httpx.AsyncClient(timeout=60) as client:
            while True:
                resp = await client.get(url, headers=headers)
                if resp.status_code != 200:
                    raise ProviderAPIError(f"Graph delta init failed: {resp.text[:300]}", resp.status_code)
                data = resp.json()
                if "@odata.deltaLink" in data:
                    return {"delta_link": data["@odata.deltaLink"]}
                url = data.get("@odata.nextLink")
                if not url:
                    raise ProviderAPIError("Graph delta init returned neither deltaLink nor nextLink")

    async def list_new_messages(self, access_token: str, sync_state: dict) -> tuple[list[ProviderMessage], dict]:
        headers = {"Authorization": f"Bearer {access_token}", "Prefer": f'odata.maxpagesize={MAX_MESSAGES_PER_SYNC}'}
        delta_link = (sync_state or {}).get("delta_link")
        if not delta_link:
            return [], await self.init_sync_state(access_token)

        messages: list[ProviderMessage] = []
        url = delta_link
        new_delta = delta_link
        async with httpx.AsyncClient(timeout=60) as client:
            while url:
                resp = await client.get(url, headers=headers)
                if resp.status_code == 410:
                    # Delta cursor expired — re-baseline (skips the gap rather than backfilling)
                    return messages, await self.init_sync_state(access_token)
                if resp.status_code == 429:
                    raise ProviderAPIError(
                        "Graph rate limited", 429,
                        retry_after=float(resp.headers.get("Retry-After", 60)),
                    )
                if resp.status_code != 200:
                    raise ProviderAPIError(f"Graph delta failed: {resp.text[:300]}", resp.status_code)
                data = resp.json()
                for item in data.get("value", []):
                    # Delta also emits removals/updates — only ingest real messages
                    if "@removed" in item or not item.get("id"):
                        continue
                    if len(messages) >= MAX_MESSAGES_PER_SYNC:
                        continue
                    msg = await self._to_message(client, headers, item)
                    if msg is not None:
                        messages.append(msg)
                if "@odata.deltaLink" in data:
                    new_delta = data["@odata.deltaLink"]
                    break
                url = data.get("@odata.nextLink")

        return messages, {"delta_link": new_delta}

    async def _to_message(self, client: httpx.AsyncClient, headers: dict, item: dict) -> ProviderMessage | None:
        # Delta rows can be skeletal (e.g. flag-change updates) — fetch full if body missing
        if "body" not in item or "from" not in item:
            resp = await client.get(f"{GRAPH}/me/messages/{item['id']}", headers=headers,
                                    params={"$select": DELTA_SELECT})
            if resp.status_code != 200:
                log.warning("Graph message fetch %s → HTTP %s", item.get("id"), resp.status_code)
                return None
            item = {**item, **resp.json()}

        from_field = (item.get("from") or {}).get("emailAddress") or {}
        sender = (from_field.get("address") or "").lower()
        if not sender:
            return None

        body = item.get("body") or {}
        body_text = body.get("content") if body.get("contentType") == "text" else None
        body_html = body.get("content") if body.get("contentType") == "html" else None

        msg_headers = {
            h["name"]: h["value"]
            for h in item.get("internetMessageHeaders") or []
            if h.get("name")
        }
        lower = {k.lower(): v for k, v in msg_headers.items()}

        attachments: list[ProviderAttachment] = []
        if item.get("hasAttachments"):
            att_resp = await client.get(f"{GRAPH}/me/messages/{item['id']}/attachments", headers=headers)
            if att_resp.status_code == 200:
                for att in att_resp.json().get("value", []):
                    if att.get("@odata.type") != "#microsoft.graph.fileAttachment":
                        continue
                    if int(att.get("size", 0)) > MAX_ATTACHMENT_BYTES or not att.get("contentBytes"):
                        continue
                    attachments.append(ProviderAttachment(
                        filename=att.get("name") or "attachment",
                        content_type=att.get("contentType") or "application/octet-stream",
                        content_b64=att["contentBytes"],  # Graph returns standard base64
                    ))

        return ProviderMessage(
            provider_message_id=item["id"],
            smtp_message_id=item.get("internetMessageId"),
            thread_ref=item.get("conversationId"),
            sender=sender,
            sender_name=from_field.get("name"),
            subject=item.get("subject"),
            body_text=body_text,
            body_html=body_html,
            received_at=item.get("receivedDateTime"),
            in_reply_to=lower.get("in-reply-to"),
            references_header=lower.get("references"),
            raw_headers=msg_headers,
            attachments=attachments,
        )

    async def send_message(self, access_token: str, mime_bytes: bytes, thread_ref: str | None = None) -> str:
        # thread_ref unused — Graph threads by the MIME References headers
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                f"{GRAPH}/me/sendMail",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "text/plain",
                },
                content=base64.b64encode(mime_bytes),
            )
        if resp.status_code == 401:
            raise ProviderAuthError("Outlook send unauthorized")
        if resp.status_code == 429:
            raise ProviderAPIError("Graph rate limited", 429, retry_after=float(resp.headers.get("Retry-After", 60)))
        if resp.status_code != 202:
            raise ProviderAPIError(f"Outlook send failed: {resp.text[:300]}", resp.status_code)
        # sendMail returns 202 with no body — no per-message id available
        return ""

    async def revoke(self, refresh_token: str) -> None:
        # Microsoft has no delegated-token revoke endpoint — deleting our stored
        # tokens is the effective disconnect; users can also revoke at
        # account.microsoft.com → Privacy → Apps and services.
        return None
