"""Ligação ao PostgreSQL (SQLAlchemy 2)."""
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


@lru_cache
def get_engine() -> Engine:
    settings = get_settings()
    connect_args = {}
    if settings.database_schema:
        # usado pelos testes para trabalhar num schema isolado
        connect_args["options"] = f"-csearch_path={settings.database_schema}"
    return create_engine(settings.database_url, pool_pre_ping=True, connect_args=connect_args)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Dependência FastAPI: uma sessão por pedido, sempre fechada no fim."""
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()
