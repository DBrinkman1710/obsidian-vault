"""
One-off backfill: seed standard response templates into all existing tenants.
Idempotent — skips any template whose name already exists for that tenant.

Run once via Railway "Run Command" or docker exec:
    python seed_templates.py
"""
import asyncio
import json

from sqlalchemy import select

from app.core.models import Tenant
from app.database import db_session, get_engine
from app.modules.tickets.models import ResponseTemplate
from seed import _STANDARD_TEMPLATES


async def main() -> None:
    async with db_session() as db:
        result = await db.execute(select(Tenant))
        tenants = list(result.scalars().all())

        total_added = 0
        for tenant in tenants:
            existing = await db.execute(
                select(ResponseTemplate.name).where(ResponseTemplate.tenant_id == tenant.id)
            )
            existing_names = {row[0] for row in existing.all()}

            added = 0
            for tpl in _STANDARD_TEMPLATES:
                if tpl["name"] in existing_names:
                    continue
                db.add(ResponseTemplate(
                    tenant_id=tenant.id,
                    name=tpl["name"],
                    body=tpl["body"],
                    html_body=tpl["html"],
                    design_json=json.dumps({"pages": [{"component": tpl["html"]}]}),
                ))
                added += 1

            status = f"added {added}" if added else "already up to date"
            print(f"  Tenant '{tenant.name}' ({tenant.slug}): {status}")
            total_added += added

        await db.commit()
        print(f"\nDone — {total_added} template(s) added across {len(tenants)} tenant(s).")

    await get_engine().dispose()


if __name__ == "__main__":
    asyncio.run(main())
