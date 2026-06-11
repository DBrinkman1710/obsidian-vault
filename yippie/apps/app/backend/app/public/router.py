from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db

# Public, unauthenticated endpoints — consumed by the marketing site (getyippie.com).
# Mounted in main.py WITHOUT auth dependencies. Never expose tenant-level data here;
# global aggregates only.
router = APIRouter(prefix="/public", tags=["public"])

# Average agent time saved per automated ticket, in minutes. Tunable later.
AVG_MINUTES_PER_TICKET = 15


@router.get("/stats")
async def get_public_stats(db: Annotated[AsyncSession, Depends(get_db)]) -> dict:
    """Global, cross-tenant aggregate of hours saved by Yippie.

    Intentionally NOT tenant-filtered: this powers the marketing site's
    "hours saved globally" counter, summed across all tenants.
    """
    settings = get_settings()
    result = await db.execute(
        text("SELECT COUNT(*) FROM tickets WHERE deleted_at IS NULL")
    )
    tickets_automated = int(result.scalar_one() or 0)
    hours_saved = settings.base_hours_saved + (
        tickets_automated * AVG_MINUTES_PER_TICKET
    ) // 60
    return {
        "hours_saved": hours_saved,
        "tickets_automated": tickets_automated,
    }
