"""Signed single-purpose tokens (invite, password reset) — plain JWTs on the
app secret, so no DB table is needed. The `purpose` claim prevents a token
minted for one flow from being replayed in another."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

import jwt

from app.config import get_settings


def create_signed_token(purpose: str, ttl: timedelta, **claims) -> str:
    settings = get_settings()
    payload = {"purpose": purpose, "exp": datetime.now(timezone.utc) + ttl, **claims}
    return jwt.encode(payload, settings.secret_key, algorithm=settings.algorithm)


def verify_signed_token(token: str, purpose: str) -> Optional[dict]:
    """Return the claims if the token is valid, unexpired and minted for `purpose`."""
    settings = get_settings()
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    except jwt.PyJWTError:
        return None
    if payload.get("purpose") != purpose:
        return None
    return payload
