from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Configuration injectée exclusivement par variables d'environnement."""

    model_config = SettingsConfigDict(env_file=".env", env_prefix="MEP_", extra="ignore")

    environment: str = "development"
    database_url: str = "sqlite:///./monespaceprof-dev.db"
    users_root: Path = Path("./var/users")
    backups_root: Path = Path("./var/backups")
    logs_root: Path = Path("./var/logs")
    cookie_name: str = "mep_session"
    cookie_secure: bool = False
    session_ttl_seconds: int = 43_200
    csrf_cookie_name: str = "mep_csrf"
    max_upload_bytes: int = 536_870_912
    default_quota_bytes: int = 10_737_418_240
    login_attempts_per_window: int = 8
    login_window_seconds: int = 900
    allow_self_registration: bool = False
    allowed_origins: list[str] = Field(default_factory=lambda: ["http://localhost:30080"])
    initial_rose_password: str | None = None
    public_base_url: str = "https://monespaceprof.com"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from: str | None = None
    smtp_starttls: bool = True
    app_version: str = "1.0.0"

    @field_validator("users_root", "backups_root", "logs_root", mode="before")
    @classmethod
    def expand_path(cls, value: str | Path) -> Path:
        return Path(value).expanduser().resolve()

    @property
    def is_production(self) -> bool:
        return self.environment.lower() == "production"

    @model_validator(mode="after")
    def validate_production_security(self) -> Settings:
        if not self.is_production:
            return self
        if not self.cookie_secure:
            raise ValueError("MEP_COOKIE_SECURE doit être activé en production")
        if self.database_url.startswith("sqlite"):
            raise ValueError("SQLite ne doit pas être utilisé en production")
        if not self.allowed_origins or "*" in self.allowed_origins:
            raise ValueError("MEP_ALLOWED_ORIGINS doit contenir une liste explicite en production")
        if any(not origin.startswith("https://") for origin in self.allowed_origins):
            raise ValueError("Toutes les origines de production doivent utiliser HTTPS")
        if not self.public_base_url.startswith("https://"):
            raise ValueError("MEP_PUBLIC_BASE_URL doit utiliser HTTPS en production")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
