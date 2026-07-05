"""Fernet encryption for secrets stored at rest (linked email account tokens).

Key comes from EMAIL_TOKEN_ENCRYPTION_KEY (see config.py). OAuth refresh tokens
grant standing mailbox access, so unlike per-tenant API keys they are never
stored in plaintext.
"""
from __future__ import annotations

from functools import lru_cache

from cryptography.fernet import Fernet

from app.config import get_settings


class EncryptionNotConfiguredError(RuntimeError):
    def __init__(self) -> None:
        super().__init__(
            "EMAIL_TOKEN_ENCRYPTION_KEY is not set. Generate one with "
            "`python3 -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\"` "
            "and set it in the environment."
        )


@lru_cache(maxsize=1)
def _fernet() -> Fernet:
    key = get_settings().email_token_encryption_key
    if not key:
        raise EncryptionNotConfiguredError()
    return Fernet(key.encode())


def encrypt_secret(plain: str) -> str:
    return _fernet().encrypt(plain.encode()).decode()


def decrypt_secret(token: str) -> str:
    return _fernet().decrypt(token.encode()).decode()
