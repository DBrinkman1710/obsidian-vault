from __future__ import annotations

from app.modules.email_accounts.providers.base import EmailProvider
from app.modules.email_accounts.providers.gmail import GmailProvider
from app.modules.email_accounts.providers.outlook import OutlookProvider

PROVIDERS: dict[str, EmailProvider] = {
    "gmail": GmailProvider(),
    "outlook": OutlookProvider(),
}


def get_provider(name: str) -> EmailProvider:
    try:
        return PROVIDERS[name]
    except KeyError:
        raise ValueError(f"Unknown email provider: {name}")
