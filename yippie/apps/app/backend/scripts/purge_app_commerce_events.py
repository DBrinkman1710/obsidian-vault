"""
Delete stale commerce events whose URL originates from app.getyippie.com.

These were created when sales.js was temporarily injected into the React app
frontend, tracking the platform itself instead of the marketing site.

Run via Railway:
  railway run --service Production --environment Production \
    python scripts/purge_app_commerce_events.py

Or locally against the production DB:
  DATABASE_URL=<prod-url> python scripts/purge_app_commerce_events.py
"""
import asyncio
import os

from sqlalchemy import delete, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

DATABASE_URL = os.environ["DATABASE_URL"].replace(
    "postgresql://", "postgresql+asyncpg://", 1
).replace(
    "postgres://", "postgresql+asyncpg://", 1
)


async def main() -> None:
    engine = create_async_engine(DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # Count first so the user can see what will be deleted
        count_result = await db.execute(text("""
            SELECT COUNT(*) FROM saas_events
            WHERE event_domain = 'commerce'
              AND properties->>'url' LIKE 'https://app.getyippie.com%'
        """))
        count = count_result.scalar_one()
        print(f"Found {count} stale commerce event(s) from app.getyippie.com")

        if count == 0:
            print("Nothing to delete.")
            return

        confirm = input(f"Delete all {count} events? [y/N] ").strip().lower()
        if confirm != "y":
            print("Aborted.")
            return

        await db.execute(text("""
            DELETE FROM saas_events
            WHERE event_domain = 'commerce'
              AND properties->>'url' LIKE 'https://app.getyippie.com%'
        """))
        await db.commit()
        print(f"Deleted {count} stale event(s). Sales dashboard is now clean.")

    await engine.dispose()


asyncio.run(main())
