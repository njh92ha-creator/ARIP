from sqlalchemy import create_engine, text

from app.core.config import settings


def _url() -> str:
    url = settings.database_url
    # Neon supplies postgresql://; psycopg SQLAlchemy dialect is explicit.
    return url.replace("postgresql://", "postgresql+psycopg://", 1)


engine = create_engine(_url(), pool_pre_ping=True, pool_recycle=1800)


def check_database() -> tuple[bool, str | None]:
    try:
        with engine.connect() as connection:
            connection.execute(text("select 1"))
        return True, None
    except Exception as exc:
        return False, type(exc).__name__
