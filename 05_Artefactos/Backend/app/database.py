
"""Ligação ao PostgreSQL e sessão SQLAlchemy.

Lê a configuração das variáveis de ambiente definidas pelo compose
(DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD).
"""

import os
from urllib.parse import quote_plus

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_HOST = os.getenv("DATABASE_HOST", "localhost")
DATABASE_PORT = os.getenv("DATABASE_PORT", "5432")
DATABASE_NAME = os.getenv("DATABASE_NAME", "trustvote")
DATABASE_USER = os.getenv("DATABASE_USER", "trustvote")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD", "")

DATABASE_URL = (
    f"postgresql+psycopg2://{DATABASE_USER}:{quote_plus(DATABASE_PASSWORD)}"
    f"@{DATABASE_HOST}:{DATABASE_PORT}/{DATABASE_NAME}"
)

engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    """Base declarativa dos modelos."""


def obter_sessao():
    """Dependência do FastAPI: abre uma sessão por pedido e fecha-a no fim."""
    sessao = SessionLocal()
    try:
        yield sessao
    finally:
        sessao.close()
