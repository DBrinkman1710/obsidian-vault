from __future__ import annotations

import asyncio
from logging.config import fileConfig

from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import get_settings
from app.database import Base

# Import all models so Alembic sees them
import app.core.models  # noqa
import app.modules.contacts.models  # noqa
import app.modules.tickets.models  # noqa
import app.modules.billing.models  # noqa
import app.modules.activity.models  # noqa
import app.modules.inbox.models  # noqa
import app.modules.chat.models  # noqa
import app.modules.calendar.models  # noqa
import app.modules.pipeline.models  # noqa
import app.modules.booking.models  # noqa
import app.modules.shipments.models  # noqa
import app.modules.email_accounts.models  # noqa

config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    settings = get_settings()
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection):
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    from sqlalchemy import text

    from app.database import _prepare_db_url, _make_engine
    settings = get_settings()
    url, sslmode, sslrootcert = _prepare_db_url(settings.database_url)
    engine = _make_engine(url, sslmode, sslrootcert)
    async with engine.begin() as conn:
        # devsandbox and sandbox deploy from the same branch at the same moment
        # against one shared DB — serialize their migration runs so concurrent
        # DDL/GRANTs can't race ("tuple concurrently updated"). Released on commit.
        await conn.execute(text("SELECT pg_advisory_xact_lock(912021)"))
        await conn.run_sync(do_run_migrations)
    await engine.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
