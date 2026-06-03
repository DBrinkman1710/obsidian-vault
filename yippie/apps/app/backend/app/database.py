from __future__ import annotations

import re
import ssl as _ssl_module
import sys
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


_SSL_PARAMS = {'ssl', 'sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'sslpassword'}
_SSL_MODES = {'require', 'verify-ca', 'verify-full'}


def _prepare_db_url(raw: str) -> tuple[str, bool]:
    """Normalize DATABASE_URL for asyncpg: fix scheme and strip libpq SSL params."""
    safe = re.sub(r':([^@:]+)@', ':***@', raw)
    print(f"[DB] RAW_URL={safe!r}", file=sys.stderr, flush=True)

    url = re.sub(r'^postgres(?:ql)?(?!\+)://', 'postgresql+asyncpg://', raw)
    parsed = urlparse(url)
    params = parse_qsl(parsed.query, keep_blank_values=True)
    ssl_values = {v for k, v in params if k == 'sslmode'}
    needs_ssl = bool(ssl_values & _SSL_MODES)
    clean_params = [(k, v) for k, v in params if k not in _SSL_PARAMS]
    clean_query = urlencode(clean_params)
    url = urlunparse(parsed._replace(query=clean_query))
    print(f"[DB] scheme={url.split('://')[0]!r} needs_ssl={needs_ssl} sslmode_left={'sslmode' in url}", file=sys.stderr, flush=True)
    return url, needs_ssl


def _make_engine(url: str, needs_ssl: bool, **kw):
    connect_args = {}
    if needs_ssl:
        ctx = _ssl_module.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = _ssl_module.CERT_NONE
        connect_args["ssl"] = ctx
    return create_async_engine(url, connect_args=connect_args, **kw)


def get_engine():
    global _engine
    if _engine is None:
        settings = get_settings()
        url, needs_ssl = _prepare_db_url(settings.database_url)
        _engine = _make_engine(
            url, needs_ssl,
            echo=settings.environment == "development",
            pool_pre_ping=True,
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
    """Sets tenant context for the current transaction.

    Sets app.current_tenant_id (read by RLS policies) and, when app_user
    role exists, switches to it so RLS is enforced even when connecting as
    a superuser.  Both are SET LOCAL — they revert when the transaction ends,
    making this safe in connection pools.
    """
    from sqlalchemy import text
    # UUID value is safe to inline; SET LOCAL does not accept bind parameters
    await session.execute(text(f"SET LOCAL \"app.current_tenant_id\" = '{str(tenant_id)}'"))
    # Use a SAVEPOINT so a missing role never aborts the outer transaction.
    await session.execute(text("SAVEPOINT _role_switch"))
    try:
        await session.execute(text("SET LOCAL ROLE app_user"))
        await session.execute(text("RELEASE SAVEPOINT _role_switch"))
    except Exception:
        await session.execute(text("ROLLBACK TO SAVEPOINT _role_switch"))
        await session.execute(text("RELEASE SAVEPOINT _role_switch"))
