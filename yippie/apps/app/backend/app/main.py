from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, require_module
from app.auth.router import router as auth_router
from app.config import get_settings, load_tenant_config
from app.core.models import Tenant
from app.core.schemas import TenantConfigOut
from app.database import get_db
from app.modules import MODULES
from app.modules.admin.router import router as admin_router
from app.modules.departments.router import router as departments_router
from app.modules.inbox.router import webhook_router as inbox_webhook_router
from app.modules.inbox.email_poller import start_scheduler as start_email_poller
from app.modules.tickets.automation.sla_escalation import start_scheduler as start_sla_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_sla_scheduler()
    start_email_poller()
    yield


def create_app() -> FastAPI:
    cfg = load_tenant_config()

    app = FastAPI(
        title="Yippie — Customer Platform",
        version="1.0.0",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Core routes — always present, no module gating
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(departments_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    # Public webhooks — no auth, must be mounted before module-gated routes
    app.include_router(inbox_webhook_router, prefix="/api/v1")

    @app.get("/api/v1/health", tags=["health"], include_in_schema=False)
    async def health():
        return {"status": "ok"}

    # Tenant config — dynamic per logged-in user's tenant
    @app.get("/api/v1/tenant/config", response_model=TenantConfigOut, tags=["tenant"])
    async def tenant_config(
        current_user: CurrentUser,
        db: Annotated[AsyncSession, Depends(get_db)],
    ):
        tenant = await db.get(Tenant, current_user.tenant_id)
        settings = get_settings()
        return TenantConfigOut(
            tenant_id=tenant.slug,
            tenant_name=tenant.name,
            enabled_modules=tenant.enabled_modules or [],
            branding={"primary_color": tenant.primary_color, "logo_url": tenant.logo_url},
            environment=settings.environment,
            is_demo=tenant.is_demo,
            is_active=tenant.is_active,
        )

    # Module routes — all mounted, each gated per-request by tenant's enabled_modules
    for name, module_router in MODULES.items():
        app.include_router(
            module_router,
            prefix="/api/v1",
            dependencies=[Depends(require_module(name))],
        )

    return app


app = create_app()
