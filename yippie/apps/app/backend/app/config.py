from __future__ import annotations

from typing import List, Optional

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings


# Canonical list of all compiled-in modules. The single source of truth is
# packages/config/modules.json; `pnpm sync:config` regenerates ``_modules_gen``.
# Matches the keys of ``app.modules.MODULES`` and is the default
# ``enabled_modules`` for new tenants (see app.core.models.Tenant).
from app.core._modules_gen import ALL_MODULES, BUNDLED_WITH  # noqa: E402,F401


def expand_enabled_modules(mods: "list[str] | None") -> list[str]:
    """Read-side expansion of bundled modules (``bundledWith`` in modules.json).

    A child module (e.g. ``booking``) counts as enabled whenever its parent
    (``calendar``) is in the stored list, even if the child was never written to
    ``Tenant.enabled_modules`` — older backfill migrations only patched tenants
    that existed at the time. Every read of ``enabled_modules`` used for module
    gating must go through this helper; the stored DB list is never rewritten
    (superadmin editing keeps operating on the raw list).
    """
    expanded = list(mods or [])
    for child, parent in BUNDLED_WITH.items():
        if parent in expanded and child not in expanded:
            expanded.append(child)
    return expanded


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/smb_platform"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8
    anthropic_api_key: str = ""
    # Mistral API key — used when ai_provider="mistral" (recommended: EU data residency, GDPR-safe)
    mistral_api_key: str = ""
    # Preferred model per provider:
    #   mistral   → mistral-small-latest (fast, cheap) or mistral-large-latest (quality)
    #   anthropic → claude-haiku-4-5-20251001
    #   deepseek-api → deepseek-chat
    #   self-hosted  → name of your vLLM model (e.g. Qwen/Qwen2.5-7B-Instruct)
    ai_model: str = "mistral-small-latest"
    # AI provider routing: "mistral" (default, EU) | "anthropic" | "deepseek-api" | "self-hosted"
    # Mistral is the default: French company, EU datacenters, no training on API data, GDPR-safe.
    # Self-hosted target: vLLM on Hetzner (DE/FI) with Qwen 2.5 7B — switch when volume > 100K calls/month.
    ai_provider: str = "mistral"
    # Per-workload override for the Yip agent (falls back to ai_provider/ai_model when empty).
    # Recommended: AI_AGENT_PROVIDER=anthropic + AI_AGENT_MODEL=claude-haiku-4-5-20251001 —
    # strongest tool calling for the agent loop while AI_PROVIDER=mistral keeps
    # high-volume inbox scanning cheap and EU-hosted.
    ai_agent_provider: str = ""
    ai_agent_model: str = ""
    # DeepSeek API key — used when ai_provider="deepseek-api"; set AI_MODEL=deepseek-chat
    deepseek_api_key: str = ""
    # Self-hosted OpenAI-compatible endpoint — used when ai_provider="self-hosted"
    # Target: vLLM serving Qwen2.5-7B-Instruct on Hetzner EU (AX102 or GEX130)
    ai_base_url: str = ""
    environment: str = "development"
    # Sentry error monitoring — leave empty to disable (env: SENTRY_DSN).
    # Set per Railway environment so sandbox and production report separately.
    sentry_dsn: str = ""
    resend_api_key: str = ""
    resend_from: str = ""
    resend_webhook_secret: str = ""
    # OAuth email linking (Gmail/Outlook) — one central Yippie owned app per
    # provider. Leave empty to hide the Connect buttons for that provider.
    google_oauth_client_id: str = ""
    google_oauth_client_secret: str = ""
    ms_oauth_client_id: str = ""
    ms_oauth_client_secret: str = ""
    # Fernet key for encrypting linked account tokens at rest — generate once per
    # environment with: python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
    # Losing this key orphans stored tokens (users must reconnect their accounts).
    email_token_encryption_key: str = ""
    owner_notification_email: str = "diederik1710@gmail.com"
    inbound_email: str = ""
    # Evolution API (WhatsApp) — self-hosted gateway, one instance per tenant slug.
    evolution_api_url: str = ""
    evolution_api_token: str = ""
    # Optional Twilio auth token for verifying inbound WhatsApp webhook signatures.
    twilio_auth_token: str = ""
    # Public URL of this environment's client app (e.g. https://sandbox.getyippie.com)
    # — used for links in invite and password-reset emails.
    app_base_url: str = ""
    # Override for invite/reset links in admin environments (devsandbox → sandbox,
    # dev → app). When set, invite emails point here instead of app_base_url.
    client_base_url: str = ""
    # Base offset added to the public "hours saved" counter so it never reads
    # zero on a fresh install (env: BASE_HOURS_SAVED).
    base_hours_saved: int = Field(default=10000)
    # Comma-separated list of allowed browser origins for CORS. Wildcards are not
    # permitted because the API is used with credentials.
    cors_origins: str = (
        "https://app.getyippie.com,https://dev.getyippie.com,"
        "https://sandbox.getyippie.com,https://devsandbox.getyippie.com,"
        # Marketing site fetches /api/v1/public/stats for the Hour Counter
        "https://getyippie.com,https://www.getyippie.com,"
        # My Last Bike site posts enquiry + newsletter forms to /public/lead/{slug}
        "https://mylastbike.com,https://www.mylastbike.com,"
        "http://localhost:5173,http://localhost:3000"
    )

    @field_validator("app_base_url", "client_base_url")
    @classmethod
    def _strip_trailing_slash(cls, v: str) -> str:
        # A trailing slash in the env var would yield "…com//register" links,
        # which React Router does not match.
        return v.rstrip("/")

    @property
    def effective_base_url(self) -> str:
        """app_base_url, or derived from ENVIRONMENT when APP_BASE_URL is not set.
        Always returns an absolute URL so tracking links in emails resolve correctly."""
        if self.app_base_url:
            return self.app_base_url
        _env_urls: dict[str, str] = {
            "production": "https://app.getyippie.com",
            "dev": "https://dev.getyippie.com",
            "sandbox": "https://sandbox.getyippie.com",
            "devsandbox": "https://devsandbox.getyippie.com",
        }
        return _env_urls.get(self.environment, "")

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}

    # Stripe — Layer 1 SaaS billing. Set to sk_test_... for development, sk_live_... in production.
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret_platform: str = ""
    # Slug of the root/owner tenant — used for public /meet/{slug} links in
    # demo outreach emails. Defaults to TENANT_ID if not set separately.
    owner_slug: str = ""
    # Public URL of the marketing site (getyippie.com) — used for signup links
    # in demo outreach emails.
    site_base_url: str = "https://getyippie.com"
    # Redis connection URL — injected automatically by Railway. When absent, rate
    # limiters fall back to in-memory state (single-instance safe).
    redis_url: Optional[str] = None
    # Cookie settings for HttpOnly auth tokens.
    cookie_secure: bool = True
    cookie_samesite: str = "lax"

    @property
    def cors_origins_list(self) -> List[str]:
        origins = [o.strip() for o in self.cors_origins.split(",") if o.strip()]
        if self.environment == "production":
            origins = [o for o in origins if not o.startswith("http://localhost")]
        return origins


_DEFAULT_SECRET_KEY = "change-me-in-production"

# Values of ENVIRONMENT that relax a security control.
DEV_ENVIRONMENTS = ("development", "local", "test")

_settings: Optional[Settings] = None


def is_development(settings: "Settings") -> bool:
    """True only when ENVIRONMENT was *explicitly* set to a development value.

    ``environment`` defaults to "development", so every guard phrased as
    ``if environment != "development"`` disables itself when the variable is
    simply missing. A deploy with no ENVIRONMENT would boot on the published
    default SECRET_KEY, skip webhook signature verification, and seed a known
    admin password — each failing open, silently.

    Treating "not set" as "deployed" makes all of them fail closed. It is safe
    for real development: docker-compose.yml, .env.example and tests/conftest.py
    all set ENVIRONMENT explicitly. ``model_fields_set`` is what distinguishes a
    value that came from the environment or .env from the field default.
    """
    if "environment" not in settings.model_fields_set:
        return False
    return settings.environment in DEV_ENVIRONMENTS


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
        if not is_development(_settings) and _settings.secret_key == _DEFAULT_SECRET_KEY:
            raise RuntimeError(
                "SECRET_KEY is still the insecure default. Set a real SECRET_KEY "
                f"(e.g. `openssl rand -base64 32`) for environment "
                f"'{_settings.environment}'"
                + (
                    " (ENVIRONMENT is not set, so this is treated as a deployed "
                    "environment — set ENVIRONMENT=development for local work)"
                    if "environment" not in _settings.model_fields_set
                    else ""
                )
                + "."
            )
    return _settings
