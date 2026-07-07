"""Owner error alerts — email the platform owner when production breaks.

Complements Sentry (one platform-wide SENTRY_DSN captures errors across all
tenants; individual tenants never configure anything). These alerts need no
external account at all — only the Resend key that outbound email already
requires — so the owner hears about failures even before Sentry is wired up.

Two entry points:
- ``alert_owner_error(context, exc, detail)`` — awaitable, call it directly
  from an except block or exception handler.
- ``OwnerAlertLogHandler`` — a logging handler attached to the root logger in
  production. Every ``log.exception(...)`` / ERROR-level record anywhere in
  the app (scheduler jobs, webhooks, services) triggers an alert without any
  per-call-site changes.

Alerts are deduplicated per context with a one-hour cooldown so an error storm
produces one email, not thousands. Only fires when ENVIRONMENT=production.
"""
from __future__ import annotations

import asyncio
import logging
import time
import traceback

log = logging.getLogger(__name__)

COOLDOWN_SECONDS = 3600
_last_sent: dict[str, float] = {}
# Re-entrancy guard: a failure while sending an alert must never alert again.
_sending = False


def _should_send(context: str) -> bool:
    now = time.monotonic()
    last = _last_sent.get(context)
    if last is not None and now - last < COOLDOWN_SECONDS:
        return False
    _last_sent[context] = now
    return True


async def alert_owner_error(
    context: str,
    exc: BaseException | None = None,
    detail: str = "",
) -> None:
    """Email the owner about an error. Production-only, 1/hour per context."""
    global _sending
    if _sending:
        return

    from app.config import get_settings
    from app.core.mailer import is_valid_email, send_email

    settings = get_settings()
    if settings.environment != "production":
        return
    to = settings.owner_notification_email
    if not to or not is_valid_email(to):
        return
    if not _should_send(context):
        return

    parts = [f"Context: {context}"]
    if detail:
        parts.append(detail)
    if exc is not None:
        parts.append("".join(traceback.format_exception(exc)))
    parts.append(
        "Further errors in this context are muted for an hour. "
        "Check the Railway logs (and Sentry, if configured) for the full picture."
    )
    body = "\n\n".join(parts)

    _sending = True
    try:
        await send_email(
            to=to,
            subject=f"[Yippie alert] {context}",
            body=body,
        )
    except Exception:
        log.warning("alert_owner_error: failed to send alert email for %s", context)
    finally:
        _sending = False


class OwnerAlertLogHandler(logging.Handler):
    """Root-logger handler: ERROR-level records become owner alert emails.

    Scheduler jobs and webhook handlers already ``log.exception`` their
    failures — attaching this handler in production surfaces all of them
    centrally with zero call-site changes. Fire-and-forget: never blocks or
    breaks the code path that logged the error.
    """

    def __init__(self) -> None:
        super().__init__(level=logging.ERROR)

    def emit(self, record: logging.LogRecord) -> None:
        if record.name.startswith(__name__):
            return  # never alert about the alerter
        try:
            loop = asyncio.get_running_loop()
        except RuntimeError:
            return  # no event loop (startup scripts) — Railway logs still have it
        detail = record.getMessage()
        exc = record.exc_info[1] if record.exc_info else None
        loop.create_task(alert_owner_error(f"log: {record.name}", exc=exc, detail=detail))


def install_owner_alert_log_handler() -> None:
    root = logging.getLogger()
    if any(isinstance(h, OwnerAlertLogHandler) for h in root.handlers):
        return
    root.addHandler(OwnerAlertLogHandler())
