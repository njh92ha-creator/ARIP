from __future__ import annotations

import os
from dataclasses import dataclass


def _bool(name: str, default: bool = False) -> bool:
    return os.getenv(name, str(default)).lower() in {"1", "true", "yes", "on"}


@dataclass(frozen=True)
class Settings:
    environment: str = os.getenv("ARIP_ENV", "development")
    database_url: str = os.getenv(
        "ARIP_DATABASE_URL",
        "postgresql+psycopg://arip:arip@localhost:5432/arip",
    )
    redis_url: str = os.getenv("ARIP_REDIS_URL", "redis://localhost:6379/0")
    enable_external_ai: bool = _bool("ARIP_ENABLE_EXTERNAL_AI")
    openai_secret_ref: str = os.getenv("ARIP_OPENAI_SECRET_REF", "env:OPENAI_API_KEY")
    chat_model: str = os.getenv("ARIP_CHAT_MODEL", "")
    embedding_model: str = os.getenv(
        "ARIP_EMBEDDING_MODEL", "text-embedding-3-large"
    )
    vector_namespace: str = os.getenv(
        "ARIP_VECTOR_NAMESPACE", "arip_approved_knowledge_v1"
    )
    cors_origins: tuple[str, ...] = tuple(
        origin.strip()
        for origin in os.getenv("ARIP_CORS_ORIGINS", "http://localhost:3000").split(",")
        if origin.strip()
    )


settings = Settings()

