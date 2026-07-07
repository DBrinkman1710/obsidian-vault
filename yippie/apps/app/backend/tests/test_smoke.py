"""Suite A — DB-free smoke tests.

Proves the app boots and the deploy path imports cleanly, with zero infrastructure.
The value is catching boot/wiring breakage (bad imports, broken response_models,
duplicate routes, unimportable deploy scripts) *before* a Railway push, not functional
correctness. Everything here runs without a Postgres socket.
"""
from __future__ import annotations

import importlib
from collections import Counter

import pytest
from fastapi import FastAPI
from fastapi.routing import APIRoute

from app.config import ALL_MODULES
from app.modules import MODULES


# --- App factory & wiring ---

def test_create_app_builds(app):
    """create_app() returns a FastAPI app — implicitly asserts every main.py import resolves."""
    assert isinstance(app, FastAPI)


def test_module_registry_matches_config():
    """The MODULES registry and ALL_MODULES stay in sync (same canonical module set)."""
    assert set(MODULES) == set(ALL_MODULES)


def test_all_module_routers_are_mounted(app):
    """Every module router's routes appear under /api/v1 in the built app."""
    app_paths = {r.path for r in app.routes if isinstance(r, APIRoute)}
    for name, module_router in MODULES.items():
        module_route_paths = {r.path for r in module_router.routes if isinstance(r, APIRoute)}
        assert module_route_paths, f"module {name!r} has no routes"
        missing = {p for p in module_route_paths if f"/api/v1{p}" not in app_paths}
        assert not missing, f"module {name!r} routes not mounted: {sorted(missing)}"


def test_openapi_schema_generates(app):
    """Forces FastAPI to build every route's request/response model at once —
    the highest-value single check for schema regressions across all modules."""
    schema = app.openapi()
    assert schema["openapi"]
    assert schema["paths"]


def test_no_duplicate_routes(app):
    """No two routes share the same (method, path) — catches accidental double-mounts."""
    seen = Counter()
    for route in app.routes:
        if isinstance(route, APIRoute):
            for method in route.methods:
                seen[(method, route.path)] += 1
    duplicates = {pair: n for pair, n in seen.items() if n > 1}
    assert not duplicates, f"duplicate routes: {duplicates}"


# --- Background schedulers (import only; calling them starts APScheduler / hits the DB) ---

def test_scheduler_start_functions_importable():
    """The 6 lifespan schedulers wired in main.py import without error."""
    from app.modules.contracts.scheduler import start_scheduler as _c  # noqa: F401
    from app.modules.inbox.email_poller import start_scheduler as _p  # noqa: F401
    from app.modules.jarvis.scheduler import start_scheduler as _j  # noqa: F401
    from app.modules.marketing.scheduler import start_scheduler as _m  # noqa: F401
    from app.modules.saas.scheduler import start_scheduler as _s  # noqa: F401
    from app.modules.tickets.automation.sla_escalation import start_scheduler as _e  # noqa: F401

    for fn in (_p, _j, _m, _s, _e, _c):
        assert callable(fn)


# --- Deploy-critical scripts (guarded by __main__, so import has no side effects) ---

@pytest.mark.parametrize("script", ["seed", "promote_superadmin", "run_migrations"])
def test_deploy_scripts_importable(script):
    """A broken deploy script is caught here, not mid-deploy on Railway."""
    module = importlib.import_module(script)
    assert module is not None


# --- Endpoints over the in-process ASGI transport ---

async def test_sentry_test_endpoint_raises_500(client):
    """The one truly DB-free endpoint — proves routing + error handling end to end."""
    resp = await client.get("/api/v1/public/sentry-test")
    assert resp.status_code == 500


async def test_health_ok_with_fake_db(client, override_db):
    """/health returns ok when its SELECT 1 is served by the fake session."""
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}
    override_db.execute.assert_awaited()


async def test_protected_route_requires_auth(client):
    """/tenant/config rejects unauthenticated calls before any DB work (HTTPBearer)."""
    resp = await client.get("/api/v1/tenant/config")
    assert resp.status_code in (401, 403)
