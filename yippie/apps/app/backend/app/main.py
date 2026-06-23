from __future__ import annotations

from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.auth.dependencies import CurrentUser, check_module_access, require_feature, require_module
from app.auth.router import router as auth_router
from app.config import ALL_MODULES, get_settings
from app.core.models import Tenant
from app.core.plans import ADVANCED_FEATURES, features_for_plan, limits_for_plan, module_prices_for_plan
from app.core.schemas import TenantConfigOut
from app.database import get_db
from app.modules import MODULES
from app.modules.chat.router import ws_router as chat_ws_router, webhook_router as chat_webhook_router
from app.modules.admin.router import router as admin_router
from app.modules.rbac.router import router as rbac_router
from app.modules.team.router import router as team_router
from app.modules.inbox.router import webhook_router as inbox_webhook_router
from app.modules.emailtracking.router import router as emailtracking_router
from app.modules.emailtracking.webhooks import webhook_router as emailtracking_webhook_router
from app.public.router import router as public_router
from app.modules.tracking.router import router as tracking_router
from app.modules.marketing.public_router import router as marketing_tracking_router
from app.modules.inbox.email_poller import start_scheduler as start_email_poller
from app.modules.tickets.automation.sla_escalation import start_scheduler as start_sla_scheduler
from app.modules.marketing.scheduler import start_scheduler as start_marketing_scheduler
from app.modules.saas.scheduler import start_scheduler as start_saas_scheduler
from app.modules.stripe_platform.router import router as stripe_router
from app.modules.stripe_platform.webhooks import webhook_router as stripe_webhook_router
from app.modules.shipments.router import webhook_router as shipments_webhook_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    start_sla_scheduler()
    start_email_poller()
    start_marketing_scheduler()
    start_saas_scheduler()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    is_prod = settings.environment == "production"

    app = FastAPI(
        title="Yippie — Customer Platform",
        version="1.0.0",
        # API docs are disabled in production to avoid exposing the schema/diagnostics.
        docs_url=None if is_prod else "/api/docs",
        redoc_url=None if is_prod else "/api/redoc",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Core routes — always present, no module gating
    app.include_router(auth_router, prefix="/api/v1")
    app.include_router(team_router, prefix="/api/v1")
    app.include_router(admin_router, prefix="/api/v1")
    app.include_router(rbac_router, prefix="/api/v1")
    # Public webhooks — no auth, must be mounted before module-gated routes
    app.include_router(inbox_webhook_router, prefix="/api/v1")
    # Public stats — no auth, consumed by the marketing site
    app.include_router(public_router, prefix="/api/v1")
    # Public tracked-click endpoint — no auth, contacts click from email
    app.include_router(tracking_router, prefix="/api/v1")
    # Public campaign open-pixel + unsubscribe endpoints — no auth
    app.include_router(marketing_tracking_router, prefix="/api/v1")
    # Public Resend webhook — no auth, Resend posts delivery events here
    app.include_router(emailtracking_webhook_router, prefix="/api/v1")
    # Public Stripe webhook — no auth, Stripe posts billing events here
    app.include_router(stripe_webhook_router, prefix="/api/v1")
    # Public Sendcloud shipment webhook — no auth, Sendcloud POSTs here
    app.include_router(shipments_webhook_router, prefix="/api/v1")
    # Legacy emailtracking outbound endpoint (MODULE-RENAME) — folded into the
    # marketing module as GET /marketing/outbound. Kept mounted (auth-gated, no
    # module gate) for backwards compatibility while the frontend transitions to
    # the new path. Remove once no client calls GET /emailtracking/outbound.
    app.include_router(emailtracking_router, prefix="/api/v1")
    # Chat websockets — mounted without the require_module/require_feature
    # dependencies applied to the gated module routers below, since those
    # depend on HTTPBearer (HTTP-only) and break websocket connections.
    app.include_router(chat_ws_router, prefix="/api/v1")
    # Chat inbound webhooks — no auth, Evolution API POSTs here
    app.include_router(chat_webhook_router, prefix="/api/v1")

    @app.api_route("/api/v1/health", methods=["GET", "HEAD"], tags=["health"], include_in_schema=False)
    async def health(db: Annotated[AsyncSession, Depends(get_db)]):
        await db.execute(text("SELECT 1"))
        return {"status": "ok"}

    # Tenant config — dynamic per logged-in user's tenant
    @app.get("/api/v1/tenant/config", response_model=TenantConfigOut, tags=["tenant"])
    async def tenant_config(
        current_user: CurrentUser,
        db: Annotated[AsyncSession, Depends(get_db)],
    ):
        tenant = await db.get(Tenant, current_user.tenant_id)
        if tenant is None:
            raise HTTPException(status_code=404, detail="Tenant not found")
        settings = get_settings()
        stored = tenant.enabled_modules or []
        ordered_modules = [m for m in ALL_MODULES if m in stored] + [m for m in stored if m not in ALL_MODULES]
        # allowed_features = what the plan unlocks; the frontend gates a feature
        # only when it is BOTH enabled (in enabled_modules) AND plan-allowed.
        allowed_features = sorted(features_for_plan(tenant.plan))
        return TenantConfigOut(
            tenant_id=tenant.slug,
            tenant_name=tenant.name,
            enabled_modules=ordered_modules,
            branding={"primary_color": tenant.primary_color, "logo_url": tenant.logo_url},
            environment=settings.environment,
            is_demo=tenant.is_demo,
            is_active=tenant.is_active,
            plan=tenant.plan,
            allowed_features=allowed_features,
            plan_limits=limits_for_plan(tenant.plan),
            module_prices=module_prices_for_plan(tenant.plan),
            ai_auto_scan=tenant.ai_auto_scan,
            stripe_subscription_status=tenant.stripe_subscription_status,
            stripe_publishable_key=settings.stripe_publishable_key,
            ai_scans_used_this_period=tenant.ai_scans_used_this_period,
            tracking_token=str(tenant.tracking_token) if tenant.tracking_token else None,
        )

    # Stripe auth-protected endpoints — no module gate (always accessible)
    app.include_router(stripe_router, prefix="/api/v1")

    # Module routes — all mounted, each gated per-request by tenant's enabled_modules
    # and by the user's RBAC access level for that module.
    # Advanced modules also get a plan gate: require_feature returns 402 when the
    # tenant's plan doesn't unlock the feature, on top of the 403 module gate.
    for name, module_router in MODULES.items():
        deps = [Depends(require_module(name)), Depends(check_module_access(name))]
        if name in ADVANCED_FEATURES:
            deps.append(Depends(require_feature(name)))
        app.include_router(
            module_router,
            prefix="/api/v1",
            dependencies=deps,
        )

    return app


app = create_app()
