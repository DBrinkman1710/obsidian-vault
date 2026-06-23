from __future__ import annotations

import stripe as _stripe

from app.config import get_settings

_client: _stripe.StripeClient | None = None


def get_stripe() -> _stripe.StripeClient:
    global _client
    if _client is None:
        settings = get_settings()
        _client = _stripe.StripeClient(settings.stripe_secret_key)
    return _client
