from __future__ import annotations

import re
from contextlib import asynccontextmanager
from typing import AsyncGenerator
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import get_settings


class Base(DeclarativeBase):
    pass


_engine = None
_session_factory = None


_SSL_PARAMS = {'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslpassword'}
_SSL_MODES = {'require', 'verify-ca', 'verify-full'}


def _prepare_db_url(raw: str) -> tuple[str, bool]:
    """Normalize DATABASE_URL for asyncpg: fix scheme and strip libpq SSL params."""
    # Fix scheme before parsing so urlparse sees a valid URL
    url = re.sub(r'^postgres(?:ql)?(?!\+)://', 'postgresql+asyncpg://', raw)
    parsed = urlparse(url)
    params = parse_qsl(parsed.query, keep_blank_values=True)
    ssl_values = {v for k, v in params if k == 'sslmode'}
    needs_ssl = bool(ssl_values & _SSL_MODES)
    clean_params = [(k, v) for k, v in params if k not in _SSL_PARAMS]
    clean_query = urlencode(clean_params)
    url = urlunparse(parsed._replace(query=clean_query))
    return url, needs_ssl


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        url, needs_ssl = _prepare_db_url(settings.database_url)
        _engine = create_async_engine(
            url,
            echo=settings.environment == "development",
            pool_pre_ping=True,
            **({"connect_args": {"ssl": True}} if needs_ssl else {}),
        )
    return _engine


def get_session_factory():
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with get_session_factory()() as session:
        yield session


@asynccontextmanager
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    async with get_session_factory()() as session:
        yield session


async def set_tenant_context(session: AsyncSession, tenant_id: str) -> None:
    """Sets the PostgreSQL session variable used by RLS policies."""
    from sqlalchemy import text
    # SET LOCAL does not support parameterized placeholders; UUID is safe to inline
    await session.execute(text(f"SET LOCAL \"app.current_tenant_id\" = '{str(tenant_id)}'"))
