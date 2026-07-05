"""Provider-neutral interface for linked Gmail/Outlook mailboxes.

Both providers speak plain HTTPS via httpx — no Google/Microsoft SDKs. Sending
uses raw RFC822 MIME on both sides (Gmail messages.send raw; Graph sendMail
with a base64 MIME body) so one MIME builder controls all threading headers.
"""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field


class ProviderAuthError(Exception):
    """Refresh/exchange rejected (invalid_grant etc.) — account must reconnect."""


class ProviderAPIError(Exception):
    """Non-auth provider API failure (5xx, throttling, malformed response)."""

    def __init__(self, message: str, status_code: int | None = None, retry_after: float | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.retry_after = retry_after


@dataclass
class TokenBundle:
    access_token: str
    refresh_token: str
    expires_in: int  # seconds
    email: str  # account address, lowercased
    scopes: str  # space-joined scopes actually granted
    display_name: str | None = None


@dataclass
class ProviderAttachment:
    filename: str
    content_type: str
    content_b64: str  # standard base64


@dataclass
class ProviderMessage:
    provider_message_id: str  # Gmail message id / Graph message id (dedupe key)
    smtp_message_id: str | None  # RFC822 Message-ID header (threading)
    thread_ref: str | None  # Gmail threadId / Graph conversationId
    sender: str  # email address, lowercased
    sender_name: str | None
    subject: str | None
    body_text: str | None
    body_html: str | None
    received_at: str | None  # ISO 8601
    in_reply_to: str | None
    references_header: str | None
    raw_headers: dict[str, str] = field(default_factory=dict)
    attachments: list[ProviderAttachment] = field(default_factory=list)


class EmailProvider(ABC):
    name: str

    @abstractmethod
    def is_configured(self) -> bool:
        """Whether this provider's OAuth app credentials are set in the environment."""

    @abstractmethod
    def get_authorize_url(self, redirect_uri: str, state: str, login_hint: str | None = None) -> str:
        ...

    @abstractmethod
    async def exchange_code(self, code: str, redirect_uri: str) -> TokenBundle:
        ...

    @abstractmethod
    async def refresh_access_token(self, refresh_token: str) -> tuple[str, int, str | None]:
        """Returns (access_token, expires_in, rotated_refresh_token_or_None).

        Graph rotates the refresh token on every refresh — when the third element
        is not None the caller MUST persist it.
        """

    @abstractmethod
    async def init_sync_state(self, access_token: str) -> dict:
        """Baseline sync cursor at link time — old mail is never backfilled."""

    @abstractmethod
    async def list_new_messages(self, access_token: str, sync_state: dict) -> tuple[list[ProviderMessage], dict]:
        """Incremental fetch since sync_state; returns (messages, new_sync_state)."""

    @abstractmethod
    async def send_message(self, access_token: str, mime_bytes: bytes, thread_ref: str | None = None) -> str:
        """Send raw MIME; returns the provider's id for the sent message."""

    @abstractmethod
    async def revoke(self, refresh_token: str) -> None:
        """Best-effort token revocation at the provider (no-op where unsupported)."""
