"""
Configuration module using pydantic-settings.
Loads environment variables with validation.
"""
from functools import lru_cache
from typing import List, Optional
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore"
    )

    # Application
    APP_NAME: str = "Auth0 Enterprise Platform"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = Field(default="development", pattern="^(development|staging|production)$")

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4

    # Auth0 Configuration
    AUTH0_DOMAIN: str
    AUTH0_CLIENT_ID: str
    AUTH0_CLIENT_SECRET: str
    AUTH0_AUDIENCE: str
    AUTH0_ISSUER: Optional[str] = None
    AUTH0_ALGORITHMS: List[str] = ["RS256"]
    AUTH0_CLAIMS_NAMESPACE: Optional[str] = None

    # Auth0 Management API
    AUTH0_MGMT_CLIENT_ID: Optional[str] = None
    AUTH0_MGMT_CLIENT_SECRET: Optional[str] = None

    # JWT Settings
    JWT_CLOCK_TOLERANCE: int = 30  # seconds

    # Database
    DATABASE_URL: str
    DATABASE_POOL_SIZE: int = 20
    DATABASE_POOL_MAX_OVERFLOW: int = 10
    DATABASE_POOL_TIMEOUT: int = 30
    DATABASE_ECHO: bool = False

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_MAX_CONNECTIONS: int = 10

    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = 100
    RATE_LIMIT_WINDOW: int = 900  # 15 minutes in seconds

    # CORS
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: List[str] = ["*"]
    CORS_ALLOW_HEADERS: List[str] = ["*"]

    # Logging
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"  # json or console

    # Security
    SYSTEM_ADMIN_PERMISSION: str = "system:admin"
    ORG_OVERRIDE_HEADER: str = "x-organization-override"

    # Retry Configuration
    RETRY_MAX_ATTEMPTS: int = 3
    RETRY_BASE_DELAY: float = 1.0
    RETRY_MAX_DELAY: float = 10.0

    @field_validator("AUTH0_ISSUER", mode="before")
    @classmethod
    def set_auth0_issuer(cls, v, info):
        if v:
            return v
        domain = info.data.get("AUTH0_DOMAIN")
        if domain:
            return f"https://{domain}/"
        return None

    @field_validator("AUTH0_CLAIMS_NAMESPACE", mode="before")
    @classmethod
    def set_claims_namespace(cls, v, info):
        if v:
            return v
        return info.data.get("AUTH0_AUDIENCE")

    @property
    def auth0_jwks_url(self) -> str:
        """Get JWKS URL for Auth0 tenant."""
        return f"https://{self.AUTH0_DOMAIN}/.well-known/jwks.json"

    @property
    def auth0_token_url(self) -> str:
        """Get token URL for Auth0 tenant."""
        return f"https://{self.AUTH0_DOMAIN}/oauth/token"

    @property
    def auth0_mgmt_api_url(self) -> str:
        """Get Management API base URL."""
        return f"https://{self.AUTH0_DOMAIN}/api/v2"


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Uses lru_cache to avoid reading .env file on every request.
    """
    return Settings()
