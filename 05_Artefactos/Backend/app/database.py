"""Ligação ao PostgreSQL (SQLAlchemy 2)."""
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


def _criar_engine(url) -> Engine:
    settings = get_settings()
    connect_args = {"connect_timeout": 3}
    if settings.database_schema:
        # usado pelos testes para trabalhar num schema isolado
        connect_args["options"] = f"-csearch_path={settings.database_schema}"
    # pool_pre_ping: uma ligação que morreu (ex.: BD reiniciada ou promovida) é trocada por uma nova
    return create_engine(url, pool_pre_ping=True, connect_args=connect_args)


@lru_cache
def get_engine() -> Engine:
    """Primário: todas as escritas e as leituras que têm de estar atualizadas."""
    return _criar_engine(get_settings().database_url)


@lru_cache
def get_engine_leitura() -> Engine:
    """Réplica (ou o primário, se a réplica falhar): leituras que toleram um pequeno atraso."""
    return _criar_engine(get_settings().database_read_url)


@lru_cache
def get_session_factory() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine(), expire_on_commit=False)


@lru_cache
def get_session_factory_leitura() -> sessionmaker[Session]:
    return sessionmaker(bind=get_engine_leitura(), expire_on_commit=False)


def get_db() -> Iterator[Session]:
    """Dependência FastAPI: uma sessão por pedido, sempre fechada no fim."""
    db = get_session_factory()()
    try:
        yield db
    finally:
        db.close()


def get_db_leitura() -> Iterator[Session]:
    """Como get_db, mas na réplica. Usar só em rotas que não escrevem."""
    db = get_session_factory_leitura()()
    try:
        yield db
    finally:
        db.close()
