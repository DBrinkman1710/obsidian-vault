"""Structured JSON logging + per-request ID for the Yippie backend.

Call configure_logging() once at startup (main.py) to replace all root
logger handlers with a JSON stream handler.

The RequestIDMiddleware generates a UUID per request and stores it in
request_id_ctx so the formatter can include it in every log record —
grep for a single request_id to see all log lines for one HTTP call.
"""
from __future__ import annotations

import contextvars
import json
import logging
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

# Stores the current request ID across async boundaries.
request_id_ctx: contextvars.ContextVar[str] = contextvars.ContextVar(
    "request_id", default=""
)


class JsonFormatter(logging.Formatter):
    def format(self, record: logging.LogRecord) -> str:
        data: dict = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%SZ"),
            "level": record.levelname,
            "logger": record.name,
            "msg": record.getMessage(),
        }
        rid = request_id_ctx.get("")
        if rid:
            data["request_id"] = rid
        if record.exc_info:
            data["exc"] = self.formatException(record.exc_info)
        return json.dumps(data, ensure_ascii=False)


class RequestIDMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        rid = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        token = request_id_ctx.set(rid)
        try:
            response = await call_next(request)
        finally:
            request_id_ctx.reset(token)
        response.headers["X-Request-ID"] = rid
        return response


def configure_logging(level: str = "INFO") -> None:
    """Replace root logger handlers with a single JSON stream handler."""
    root = logging.getLogger()
    for h in root.handlers[:]:
        root.removeHandler(h)
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter())
    root.addHandler(handler)
    root.setLevel(getattr(logging, level.upper(), logging.INFO))
    # Quiet noisy third-party loggers
    logging.getLogger("apscheduler").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(logging.WARNING)
    logging.getLogger("httpx").setLevel(logging.WARNING)
