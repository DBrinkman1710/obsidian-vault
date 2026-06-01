from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.auth.router import router as auth_router
from app.config import load_tenant_config
from app.core.schemas import TenantConfigOut
from app.modules import MODULES
from app.modules.departments.router import router as departments_router
from app.modules.tickets.automation.sla_escalation import start_scheduler


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_scheduler()
    yield


def create_app() -> FastAPI:
    cfg = load_tenant_config()

    app = FastAPI(
        title=f"{cfg.tenant_name} — Customer Platform",
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

    # Module-disabled guard middleware
    @app.middleware("http")
    async def module_guard(request: Request, call_next):
        path = request.url.path
        if path.startswith("/api/v1/"):
            segment = path.removeprefix("/api/v1/").split("/")[0]
            if segment in MODULES and segment not in cfg.enabled_modules:
                return JSONResponse(
                    status_code=status.HTTP_403_FORBIDDEN,
                    content={"error": "module_disabled", "module": segment},
                )
        return await call_next(request)

    # Core routes — always present
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(departments_router, prefix="/api/v1")

    @app.get("/api/v1/tenant/config", response_model=TenantConfigOut, tags=["tenant"])
    async def tenant_config():
        return TenantConfigOut(
            tenant_id=cfg.tenant_id,
            tenant_name=cfg.tenant_name,
            enabled_modules=cfg.enabled_modules,
            branding=cfg.branding.model_dump(),
        )

    # Module routes — conditionally registered
    for name, module_router in MODULES.items():
        if name in cfg.enabled_modules:
            app.include_router(module_router, prefix="/api/v1")

    return app


app = create_app()
