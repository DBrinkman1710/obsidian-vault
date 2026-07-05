"""RFC822 MIME builder shared by both providers.

One builder → full control over In-Reply-To/References/Message-ID on Gmail and
Graph alike (Graph's JSON payload only allows x- prefixed custom headers, so we
always send raw MIME instead).
"""
from __future__ import annotations

import base64
from email.message import EmailMessage
from email.utils import formataddr, make_msgid

# Marks mail sent by Yippie so the inbound sync never re-ingests our own sends
YIPPIE_SENT_HEADER = "X-Yippie-Sent"


def build_mime(
    *,
    from_email: str,
    from_name: str | None = None,
    to: list[str],
    subject: str,
    text: str,
    html: str | None = None,
    cc: list[str] | None = None,
    bcc: list[str] | None = None,
    attachments: list[dict] | None = None,  # [{filename, content_type, content_b64}]
    in_reply_to: str | None = None,
    references: str | None = None,
) -> tuple[bytes, str]:
    """Build an RFC822 message; returns (mime_bytes, message_id)."""
    msg = EmailMessage()
    msg["From"] = formataddr((from_name, from_email)) if from_name else from_email
    msg["To"] = ", ".join(to)
    if cc:
        msg["Cc"] = ", ".join(cc)
    if bcc:
        msg["Bcc"] = ", ".join(bcc)
    msg["Subject"] = subject
    message_id = make_msgid(domain=from_email.split("@", 1)[-1])
    msg["Message-ID"] = message_id
    if in_reply_to:
        msg["In-Reply-To"] = in_reply_to
        msg["References"] = f"{references} {in_reply_to}".strip() if references else in_reply_to
    msg[YIPPIE_SENT_HEADER] = "1"

    msg.set_content(text)
    if html:
        msg.add_alternative(html, subtype="html")

    for att in attachments or []:
        content = base64.b64decode(att["content_b64"])
        maintype, _, subtype = (att.get("content_type") or "application/octet-stream").partition("/")
        msg.add_attachment(
            content,
            maintype=maintype or "application",
            subtype=subtype or "octet-stream",
            filename=att.get("filename") or "attachment",
        )

    return msg.as_bytes(), message_id
