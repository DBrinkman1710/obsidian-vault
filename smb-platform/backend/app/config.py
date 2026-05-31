from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional

import yaml
from pydantic import BaseModel
from pydantic_settings import BaseSettings


class BrandingConfig(BaseModel):
    primary_color: str = "#2563EB"
    logo_url: Optional[str] = None


class FeaturesConfig(BaseModel):
    max_users: int = 25
    max_contacts: int = 10000
    auto_close_days: int = 7


class InboxConfig(BaseModel):
    inbound_email: Optional[str] = None
    whatsapp_number: Optional[str] = None
    mailgun_domain: Optional[str] = None
    mailgun_api_key: Optional[str] = None
    twilio_account_sid: Optional[str] = None
    twilio_auth_token: Optional[str] = None


ALL_MODULES = {"contacts", "tickets", "billing", "activity", "inbox", "chat"}


class TenantConfig(BaseModel):
    tenant_id: str
    tenant_name: str
    enabled_modules: List[str] = list(ALL_MODULES)
    branding: BrandingConfig = BrandingConfig()
    features: FeaturesConfig = FeaturesConfig()
    inbox: InboxConfig = InboxConfig()

    def is_module_enabled(self, name: str) -> bool:
        return name in self.enabled_modules


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@db:5432/smb_platform"
    secret_key: str = "change-me-in-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8
    tenant_config_path: str = "/app/config/tenant.yaml"
    anthropic_api_key: str = ""
    environment: str = "development"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


_settings: Optional[Settings] = None
_tenant_config: Optional[TenantConfig] = None


def get_settings() -> Settings:
    global _settings
    if _settings is None:
        _settings = Settings()
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
