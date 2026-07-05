"""EML1 unit tests — MIME builder, provider URL construction, crypto, OAuth state.

No DB required; provider HTTP is not exercised here (that needs pytest-httpx
and a linked sandbox account — see the module README).
"""
from __future__ import annotations

import base64
from datetime import timedelta
from email import message_from_bytes

import pytest

from app.auth.tokens import create_signed_token, verify_signed_token
from app.modules.email_accounts.mime import YIPPIE_SENT_HEADER, build_mime
from app.modules.email_accounts.providers.gmail import GmailProvider, _parse_from
from app.modules.email_accounts.providers.outlook import OutlookProvider


# --- MIME builder ---

def test_build_mime_basic_headers():
    mime_bytes, message_id = build_mime(
        from_email="support@acme.nl",
        from_name="Acme Support",
        to=["klant@example.nl"],
        subject="Re: Factuur",
        text="Hallo!",
    )
    msg = message_from_bytes(mime_bytes)
    assert msg["From"] == "Acme Support <support@acme.nl>"
    assert msg["To"] == "klant@example.nl"
    assert msg["Subject"] == "Re: Factuur"
    assert msg["Message-ID"] == message_id
    assert message_id.endswith("@acme.nl>")
    assert msg[YIPPIE_SENT_HEADER] == "1"
    assert msg["In-Reply-To"] is None


def test_build_mime_threading_headers():
    mime_bytes, _ = build_mime(
        from_email="support@acme.nl",
        to=["klant@example.nl"],
        subject="Re: Factuur",
        text="Hallo!",
        in_reply_to="<orig-123@example.nl>",
        references="<root-1@example.nl> <mid-2@example.nl>",
    )
    msg = message_from_bytes(mime_bytes)
    assert msg["In-Reply-To"] == "<orig-123@example.nl>"
    # References = prior chain + the message being replied to
    assert msg["References"] == "<root-1@example.nl> <mid-2@example.nl> <orig-123@example.nl>"


def test_build_mime_first_reply_references_falls_back_to_in_reply_to():
    mime_bytes, _ = build_mime(
        from_email="support@acme.nl",
        to=["klant@example.nl"],
        subject="Re: Factuur",
        text="Hallo!",
        in_reply_to="<orig-123@example.nl>",
        references=None,
    )
    msg = message_from_bytes(mime_bytes)
    assert msg["References"] == "<orig-123@example.nl>"


def test_build_mime_html_and_attachment():
    content = base64.b64encode(b"PDFBYTES").decode()
    mime_bytes, _ = build_mime(
        from_email="support@acme.nl",
        to=["klant@example.nl"],
        cc=["cc@example.nl"],
        bcc=["bcc@example.nl"],
        subject="Factuur",
        text="Zie bijlage",
        html="<p>Zie bijlage</p>",
        attachments=[{"filename": "factuur.pdf", "content_type": "application/pdf", "content_b64": content}],
    )
    msg = message_from_bytes(mime_bytes)
    assert msg["Cc"] == "cc@example.nl"
    assert msg["Bcc"] == "bcc@example.nl"
    parts = list(msg.walk())
    content_types = [p.get_content_type() for p in parts]
    assert "text/plain" in content_types
    assert "text/html" in content_types
    assert "application/pdf" in content_types
    pdf = next(p for p in parts if p.get_content_type() == "application/pdf")
    assert pdf.get_filename() == "factuur.pdf"
    assert pdf.get_payload(decode=True) == b"PDFBYTES"


# --- Provider authorize URLs ---

def test_gmail_authorize_url(monkeypatch):
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "gid-123")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "gsecret")
    _reset_settings()
    url = GmailProvider().get_authorize_url("https://app.getyippie.com/cb", "state-abc")
    assert url.startswith("https://accounts.google.com/o/oauth2/v2/auth?")
    assert "client_id=gid-123" in url
    assert "access_type=offline" in url
    assert "prompt=consent" in url
    assert "state=state-abc" in url
    assert "gmail.send" in url and "gmail.readonly" in url


def test_outlook_authorize_url(monkeypatch):
    monkeypatch.setenv("MS_OAUTH_CLIENT_ID", "mid-456")
    monkeypatch.setenv("MS_OAUTH_CLIENT_SECRET", "msecret")
    _reset_settings()
    url = OutlookProvider().get_authorize_url("https://app.getyippie.com/cb", "state-xyz")
    assert url.startswith("https://login.microsoftonline.com/common/oauth2/v2.0/authorize?")
    assert "client_id=mid-456" in url
    assert "offline_access" in url
    assert "Mail.Read" in url and "Mail.Send" in url
    assert "state=state-xyz" in url


def test_provider_is_configured_toggles(monkeypatch):
    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT_ID", raising=False)
    monkeypatch.delenv("GOOGLE_OAUTH_CLIENT_SECRET", raising=False)
    _reset_settings()
    assert GmailProvider().is_configured() is False
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_ID", "x")
    monkeypatch.setenv("GOOGLE_OAUTH_CLIENT_SECRET", "y")
    _reset_settings()
    assert GmailProvider().is_configured() is True


def test_parse_from():
    assert _parse_from("Jan de Vries <Jan@Acme.NL>") == ("Jan de Vries", "jan@acme.nl")
    assert _parse_from("plain@acme.nl") == (None, "plain@acme.nl")


# --- Token crypto ---

def test_encrypt_decrypt_round_trip(monkeypatch):
    from cryptography.fernet import Fernet

    monkeypatch.setenv("EMAIL_TOKEN_ENCRYPTION_KEY", Fernet.generate_key().decode())
    _reset_settings()
    _reset_fernet()
    from app.core.crypto import decrypt_secret, encrypt_secret

    token = "1//refresh-token-value"
    encrypted = encrypt_secret(token)
    assert encrypted != token
    assert decrypt_secret(encrypted) == token


def test_encrypt_without_key_raises(monkeypatch):
    monkeypatch.delenv("EMAIL_TOKEN_ENCRYPTION_KEY", raising=False)
    _reset_settings()
    _reset_fernet()
    from app.core.crypto import EncryptionNotConfiguredError, encrypt_secret

    with pytest.raises(EncryptionNotConfiguredError):
        encrypt_secret("secret")


# --- OAuth state token ---

def test_state_token_round_trip():
    state = create_signed_token(
        "email_oauth", timedelta(minutes=10),
        tenant_id="t-1", user_id="u-1", level="user", provider="gmail",
    )
    claims = verify_signed_token(state, "email_oauth")
    assert claims is not None
    assert claims["tenant_id"] == "t-1"
    assert claims["level"] == "user"
    assert claims["provider"] == "gmail"


def test_state_token_rejects_wrong_purpose():
    state = create_signed_token("email_oauth", timedelta(minutes=10), tenant_id="t-1")
    assert verify_signed_token(state, "invite") is None


def test_state_token_rejects_garbage():
    assert verify_signed_token("not-a-jwt", "email_oauth") is None


# --- helpers ---

def _reset_settings() -> None:
    """get_settings() caches a singleton — drop it so monkeypatched env applies."""
    import app.config as config_module

    config_module._settings = None


def _reset_fernet() -> None:
    from app.core import crypto

    crypto._fernet.cache_clear()
