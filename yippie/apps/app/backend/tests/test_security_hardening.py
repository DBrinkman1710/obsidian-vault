"""Regression tests for the security hardening batch (Phase 1).

DB-free by construction so they run inside the Dockerfile.railway pytest gate,
which has no Postgres. Each test pins a specific hole found in the audit; the
comment on each names the failure it prevents from returning.
"""
from __future__ import annotations

import pytest


# --------------------------------------------------- open redirect (tracking)

BASE = "https://app.getyippie.com"


@pytest.mark.parametrize(
    "hostile",
    [
        # The original bug: prefix match, not origin match. Every one of these
        # startswith(BASE) or startswith("") and so used to pass straight through.
        "https://app.getyippie.com.evil.com/steal",
        "https://app.getyippie.com@evil.com/steal",
        "https://app.getyippie.comevil.com",
        "http://app.getyippie.com/downgraded",  # scheme must match too
        "https://evil.com/phish",
        "//evil.com/protocol-relative",
        "/\\evil.com/backslash",
        "javascript:alert(1)",
        "data:text/html,<script>alert(1)</script>",
        "relative-without-leading-slash",
    ],
)
def test_safe_redirect_target_rejects_hostile_destinations(hostile):
    from app.modules.tracking.router import CONFIRM_PATH, safe_redirect_target

    assert safe_redirect_target(hostile, BASE) == CONFIRM_PATH


@pytest.mark.parametrize(
    "benign",
    ["/track/confirm", "/thanks?x=1", BASE + "/inbox", BASE + "/tickets?id=3"],
)
def test_safe_redirect_target_allows_relative_and_same_origin(benign):
    from app.modules.tracking.router import safe_redirect_target

    assert safe_redirect_target(benign, BASE) == benign


def test_safe_redirect_target_fails_closed_on_empty_base():
    """APP_BASE_URL unset must not mean 'allow everything'.

    effective_base_url returns "" for an unrecognised ENVIRONMENT as well as an
    unset APP_BASE_URL, so this path is genuinely reachable in production.
    """
    from app.modules.tracking.router import CONFIRM_PATH, safe_redirect_target

    assert safe_redirect_target("https://evil.com", "") == CONFIRM_PATH
    assert safe_redirect_target(BASE + "/inbox", "") == CONFIRM_PATH
    # A relative path is still safe with no base — it cannot leave the origin.
    assert safe_redirect_target("/track/confirm", "") == "/track/confirm"


def test_safe_redirect_target_handles_empty_and_none():
    from app.modules.tracking.router import CONFIRM_PATH, safe_redirect_target

    assert safe_redirect_target(None, BASE) == CONFIRM_PATH
    assert safe_redirect_target("", BASE) == CONFIRM_PATH
    assert safe_redirect_target("   ", BASE) == CONFIRM_PATH


# ------------------------------------------------- authorization on mounts

def _dependency_calls(route):
    """Every callable in a route's dependency tree, flattened."""
    seen = []

    def walk(dep):
        if dep.call is not None:
            seen.append(dep.call)
        for sub in dep.dependencies:
            walk(sub)

    walk(route.dependant)
    return seen


def _routes_under(app, prefix):
    return [r for r in app.routes if getattr(r, "path", "").startswith(prefix)]


def test_jarvis_routes_enforce_per_user_module_access(app):
    """Jarvis is mounted outside the MODULES loop, so it does not get
    check_module_access for free. Without it, a 'worker' — restricted from every
    module by resolve_module_access — can read contacts, tickets and full ticket
    threads through the AI assistant, and write via /capture, /confirm, /train.
    """
    routes = _routes_under(app, "/api/v1/jarvis")
    assert routes, "no jarvis routes mounted — did the prefix change?"

    for route in routes:
        names = [getattr(c, "__qualname__", "") for c in _dependency_calls(route)]
        assert any("check_module_access" in n for n in names), (
            f"{route.path} has no per-user RBAC gate; deps={names}"
        )


# Routes under a module prefix that are deliberately unauthenticated. Each is
# mounted from a separate webhook/websocket router rather than the MODULES loop,
# and is authenticated by something other than a user session:
#   - webhooks verify a provider signature or a per-tenant secret
#   - /flows/hook carries a secret token in the path and is rate limited per token
#   - the chat widget routes serve anonymous visitors by design
#   - /chat/ws/agent authenticates from the cookie inside the handler, because a
#     WebSocket handshake cannot raise HTTPException from a dependency
PUBLIC_MODULE_ROUTES = {
    "/api/v1/inbox/webhooks/{tenant_slug}/email",
    "/api/v1/inbox/webhooks/{tenant_slug}/whatsapp",
    "/api/v1/chat/webhooks/{tenant_slug}/whatsapp",
    "/api/v1/chat/public/sessions/{visitor_id}/messages",
    "/api/v1/chat/ws/{tenant_slug}/{session_id}",
    "/api/v1/chat/ws/agent",
    "/api/v1/flows/hook/{token}",
}


def test_every_module_router_route_has_rbac_gate(app):
    """The property the Jarvis bug violated, asserted across the board.

    The allow-list is the point: a NEW route under a module prefix with no
    per-user gate fails this test, forcing a deliberate choice rather than an
    accidental hole. Adding an entry above should be a reviewed decision.
    """
    from app.config import ALL_MODULES

    missing = []
    for module in ALL_MODULES:
        for route in _routes_under(app, f"/api/v1/{module}"):
            if route.path in PUBLIC_MODULE_ROUTES:
                continue
            names = [getattr(c, "__qualname__", "") for c in _dependency_calls(route)]
            if not any("check_module_access" in n for n in names):
                missing.append(route.path)
    assert not missing, f"module routes without a per-user RBAC gate: {sorted(set(missing))}"


def test_public_route_allowlist_has_no_stale_entries(app):
    """Keeps the allow-list honest — a renamed or deleted public route must not
    linger and silently exempt a future route that reuses its path.
    """
    live = {getattr(r, "path", "") for r in app.routes}
    stale = PUBLIC_MODULE_ROUTES - live
    assert not stale, f"allow-list references routes that no longer exist: {sorted(stale)}"


def test_billing_mutations_are_admin_only(app):
    """Checkout and the Stripe portal change what the whole workspace is billed —
    the portal can cancel the subscription outright. These were CurrentUser, so
    any member (a viewer included) could reach them.
    """
    from app.auth.dependencies import require_admin

    for path in ("/api/v1/stripe/checkout", "/api/v1/stripe/portal"):
        routes = _routes_under(app, path)
        assert routes, f"{path} not mounted"
        for route in routes:
            assert require_admin in _dependency_calls(route), f"{path} is not admin-gated"


def test_subscription_read_stays_available_to_all_members(app):
    """The read is deliberately not admin-gated: the UI shows plan limits and AI
    usage warnings to everyone. Pinned so the fix above is not over-applied.
    """
    from app.auth.dependencies import require_admin

    routes = _routes_under(app, "/api/v1/stripe/subscription")
    assert routes
    for route in routes:
        assert require_admin not in _dependency_calls(route)


# ------------------------------------------- fail-open environment guards

def _settings_with(monkeypatch, **env):
    """Build a real Settings from a controlled environment.

    _env_file=None keeps a developer's local .env out of the assertion.
    """
    from app.config import Settings

    for key in ("ENVIRONMENT", "SECRET_KEY", "RESEND_WEBHOOK_SECRET"):
        monkeypatch.delenv(key, raising=False)
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    return Settings(_env_file=None)


def test_unset_environment_is_not_treated_as_development(monkeypatch):
    """The core of the bug: `environment` defaults to "development", so every
    guard written as `environment != "development"` disabled itself whenever the
    variable was simply missing from a deployed service.
    """
    from app.config import is_development

    s = _settings_with(monkeypatch)
    assert s.environment == "development"      # the default still reads this way
    assert is_development(s) is False          # but it no longer relaxes anything


@pytest.mark.parametrize("env", ["development", "local", "test"])
def test_explicit_dev_environments_are_development(monkeypatch, env):
    from app.config import is_development

    assert is_development(_settings_with(monkeypatch, ENVIRONMENT=env)) is True


@pytest.mark.parametrize("env", ["production", "sandbox", "dev", "devsandbox", "staging"])
def test_deployed_environments_are_not_development(monkeypatch, env):
    from app.config import is_development

    assert is_development(_settings_with(monkeypatch, ENVIRONMENT=env)) is False


def test_secret_key_guard_fires_when_environment_is_unset(monkeypatch):
    """A service with no ENVIRONMENT and the published default SECRET_KEY could
    boot, making every JWT forgeable. That must now be a hard startup failure.
    """
    import app.config as config

    monkeypatch.setattr(config, "_settings", None)
    monkeypatch.delenv("ENVIRONMENT", raising=False)
    monkeypatch.setenv("SECRET_KEY", config._DEFAULT_SECRET_KEY)
    with pytest.raises(RuntimeError, match="SECRET_KEY is still the insecure default"):
        config.get_settings()
    monkeypatch.setattr(config, "_settings", None)


def test_resend_webhook_rejects_unsigned_events_when_environment_is_unset(monkeypatch):
    """With no secret configured and no ENVIRONMENT set, the old code returned
    True — accepting any unsigned POST as a genuine Resend delivery event.
    """
    import app.modules.emailtracking.webhooks as hooks

    monkeypatch.setattr(hooks, "get_settings", lambda: _settings_with(monkeypatch))
    assert hooks._verify_signature(b"{}", None, None, None) is False


def test_resend_webhook_still_skips_verification_in_real_development(monkeypatch):
    """Local development must keep working without a Resend secret."""
    import app.modules.emailtracking.webhooks as hooks

    monkeypatch.setattr(
        hooks, "get_settings", lambda: _settings_with(monkeypatch, ENVIRONMENT="development")
    )
    assert hooks._verify_signature(b"{}", None, None, None) is True


# ---------------------------------------------- rate limits on token endpoints

@pytest.fixture(autouse=False)
def _clear_rl_fallback():
    """Rate-limit state lives in a module-global when Redis is absent (which it
    is in tests), so it must be reset or tests leak budget into each other."""
    from app.core import rate_limit

    rate_limit._fallback.clear()
    yield
    rate_limit._fallback.clear()


async def test_token_guess_budget_blocks_after_the_limit(_clear_rl_fallback):
    from app.public.router import (
        _TOKEN_GUESS_LIMIT,
        _token_guess_check,
        _token_guess_record,
    )
    from fastapi import HTTPException

    ip = "203.0.113.7"
    for _ in range(_TOKEN_GUESS_LIMIT):
        await _token_guess_check(ip, "demo_enter")   # still under budget
        await _token_guess_record(ip, "demo_enter")

    with pytest.raises(HTTPException) as exc:
        await _token_guess_check(ip, "demo_enter")
    assert exc.value.status_code == 429


async def test_token_guess_budget_is_per_ip_and_per_bucket(_clear_rl_fallback):
    """A burned budget must not spill onto another visitor or a different endpoint."""
    from app.public.router import (
        _TOKEN_GUESS_LIMIT,
        _token_guess_check,
        _token_guess_record,
    )

    attacker, bystander = "203.0.113.7", "203.0.113.8"
    for _ in range(_TOKEN_GUESS_LIMIT + 5):
        await _token_guess_record(attacker, "demo_enter")

    # Neither a different IP nor a different endpoint is affected.
    await _token_guess_check(bystander, "demo_enter")
    await _token_guess_check(attacker, "calendar_feed")


async def test_demo_enter_rejects_bad_tokens_then_rate_limits(client, override_db, _clear_rl_fallback):
    """End to end through the app: /demo-enter exchanges a token for an auth
    cookie, so repeated guessing must stop rather than run forever.
    """
    from app.public.router import _TOKEN_GUESS_LIMIT

    seen = set()
    for _ in range(_TOKEN_GUESS_LIMIT):
        r = await client.get("/api/v1/public/demo-enter", params={"token": "not-a-real-token"})
        seen.add(r.status_code)
    assert seen == {400}, f"expected only rejections before the limit, saw {seen}"

    blocked = await client.get("/api/v1/public/demo-enter", params={"token": "not-a-real-token"})
    assert blocked.status_code == 429


async def test_valid_traffic_does_not_burn_the_guess_budget(_clear_rl_fallback):
    """The reason only failures are counted: a calendar client polls on a
    schedule, and a whole office can share one egress IP. Counting successes
    would 429 legitimate subscribers.
    """
    from app.public.router import _TOKEN_GUESS_LIMIT, _token_guess_check

    ip = "203.0.113.9"
    for _ in range(_TOKEN_GUESS_LIMIT * 3):
        await _token_guess_check(ip, "calendar_feed")   # never records — no 429


def test_reset_password_is_rate_limited():
    """/forgot-password was limited but /reset-password — which consumes a token
    and sets a password — was not.
    """
    import inspect

    from app.auth.router import reset_password

    assert "request" in inspect.signature(reset_password).parameters
    assert "reset-consume" in inspect.getsource(reset_password)
