"""Configuration for the FastAPI service."""

from __future__ import annotations

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables."""

    APP_NAME: str = "Master Mind AI"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False

    MEM0_API_KEY: str
    OPENAI_API_KEY: str | None = None

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


def _build_settings() -> Settings:
    return Settings()


settings = _build_settings()

__all__ = ["settings", "Settings"]
