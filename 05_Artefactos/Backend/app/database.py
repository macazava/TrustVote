
"""Ligação ao PostgreSQL e sessão SQLAlchemy.

Lê a configuração das variáveis de ambiente definidas pelo compose
(DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD).

DATABASE_HOST aceita vários nós separados por vírgulas, com porta opcional
(`db-primary,db-replica`). A ligação procura o nó que aceita escritas, por isso
depois de um failover basta voltar a ligar, sem reiniciar a API.
"""

import os

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

load_dotenv()

DATABASE_HOST = os.getenv("DATABASE_HOST", "localhost")
DATABASE_PORT = os.getenv("DATABASE_PORT", "5432")
DATABASE_NAME = os.getenv("DATABASE_NAME", "trustvote")
DATABASE_USER = os.getenv("DATABASE_USER", "trustvote")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD", "")

NOS = tuple(
    no.strip() if ":" in no else f"{no.strip()}:{DATABASE_PORT}"
    for no in DATABASE_HOST.split(",")
    if no.strip()
)

DATABASE_URL = URL.create(
    "postgresql+psycopg2",
    username=DATABASE_USER,
    password=DATABASE_PASSWORD,
    database=DATABASE_NAME,
    query={"host": NOS},
)

# tcp_user_timeout desiste de uma ligação cujo nó desapareceu, em vez de ficar à espera.
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,
    connect_args={
        "target_session_attrs": "read-write",
        "connect_timeout": 2,
        "tcp_user_timeout": 2000,
    },
)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


class Base(DeclarativeBase):
    """Base declarativa dos modelos."""


def gravar(sessao, objeto):
    """Grava as alterações pendentes e devolve o objeto atualizado."""
    sessao.commit()
    sessao.refresh(objeto)
    return objeto


def apagar(sessao, objeto) -> None:
    sessao.delete(objeto)
    sessao.commit()


def obter_sessao():
    """Dependência do FastAPI: abre uma sessão por pedido e fecha-a no fim."""
    sessao = SessionLocal()
    try:
        yield sessao
    finally:
        sessao.close()
