from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

import yaml
from pydantic import BaseModel, Field, field_validator
from pydantic_settings import BaseSettings


class BrandingConfig(BaseModel):
    primary_color: str = "#5BA4F5"
    logo_url: Optional[str] = None


class FeaturesConfig(BaseModel):
    max_users: int = 25
    max_contacts: int = 10000
    auto_close_days: int = 7


class InboxConfig(BaseModel):
    inbound_email: Optional[str] = None


class WhatsAppConfig(BaseModel):
    """Meta Cloud API credentials for WhatsApp Business."""
    phone_number_id: Optional[str] = None   # From Meta Developer Console
    access_token: Optional[str] = None       # Permanent system user token
    verify_token: Optional[str] = None       # Any secret string you choose for webhook verification
    display_phone: Optional[str] = None      # e.g. "+31612345678" (shown in UI)


ALL_MODULES = ['inbox', 'contacts', 'tickets', 'calendar', 'pipeline', 'booking', 'activity', 'billing', 'chat', 'emailtracking']


class TenantConfig(BaseModel):
    tenant_id: str
    tenant_name: str
    enabled_modules: List[str] = list(ALL_MODULES)
    branding: BrandingConfig = BrandingConfig()
    features: FeaturesConfig = FeaturesConfig()
    inbox: InboxConfig = InboxConfig()
    whatsapp: WhatsAppConfig = WhatsAppConfig()

    def is_module_enabled(self, name: str) -> bool:
        return name in self.enabled_modules


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/smb_platform"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8
    tenant_config_path: str = "/app/config/tenant.yaml"
    anthropic_api_key: str = ""
    ai_model: str = "claude-haiku-4-5-20251001"
    environment: str = "development"
    resend_api_key: str = ""
    resend_from: str = ""
    resend_webhook_secret: str = ""
    inbound_email: str = ""
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

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


_DEFAULT_SECRET_KEY = "change-me-in-production"

_settings: Optional[Settings] = None
_tenant_config: Optional[TenantConfig] = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
        if (
            _settings.environment != "development"
            and _settings.secret_key == _DEFAULT_SECRET_KEY
        ):
            raise RuntimeError(
                "SECRET_KEY is still the insecure default. Set a real SECRET_KEY "
                f"(e.g. `openssl rand -base64 32`) for environment '{_settings.environment}'."
            )
    return _settings


def load_tenant_config() -> TenantConfig:
    global _tenant_config
    if _tenant_config is not None:
        return _tenant_config

    settings = get_settings()
    config_path = Path(settings.tenant_config_path)

    if config_path.exists():
        with open(config_path) as f:
            data = yaml.safe_load(f)
        _tenant_config = TenantConfig(**data)
    else:
        _tenant_config = TenantConfig(
            tenant_id=os.getenv("TENANT_ID", "default"),
            tenant_name=os.getenv("TENANT_NAME", "Default Tenant"),
            enabled_modules=os.getenv("ENABLED_MODULES", ",".join(ALL_MODULES)).split(","),
        )

    return _tenant_config
