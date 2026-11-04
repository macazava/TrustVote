
"""Ligação ao PostgreSQL e sessão SQLAlchemy.

Lê a configuração das variáveis de ambiente definidas pelo compose
(DATABASE_HOST, DATABASE_PORT, DATABASE_NAME, DATABASE_USER, DATABASE_PASSWORD).

DATABASE_HOST aceita vários nós separados por vírgulas, com porta opcional
(`db-primary,db-replica`). A ligação procura o nó que aceita escritas, por isso
depois de um failover basta voltar a ligar, sem reiniciar a API.

DATABASE_READ_HOST (opcional) indica a réplica usada nas leituras públicas.
Essa ligação prefere um nó em standby e, se não houver nenhum, usa o primário.
"""

import os

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import NullPool

load_dotenv()

DATABASE_HOST = os.getenv("DATABASE_HOST", "localhost")
DATABASE_PORT = os.getenv("DATABASE_PORT", "5432")
DATABASE_NAME = os.getenv("DATABASE_NAME", "trustvote")
DATABASE_USER = os.getenv("DATABASE_USER", "trustvote")
DATABASE_PASSWORD = os.getenv("DATABASE_PASSWORD", "")

DATABASE_READ_HOST = os.getenv("DATABASE_READ_HOST", "")


def _nos(lista: str) -> tuple[str, ...]:
    return tuple(
        no.strip() if ":" in no else f"{no.strip()}:{DATABASE_PORT}"
        for no in lista.split(",")
        if no.strip()
    )


NOS = _nos(DATABASE_HOST)
# A réplica primeiro; os nós de escrita ficam como alternativa.
NOS_LEITURA = tuple(dict.fromkeys(_nos(DATABASE_READ_HOST) + NOS))


def _url(nos: tuple[str, ...]) -> URL:
    return URL.create(
        "postgresql+psycopg2",
        username=DATABASE_USER,
        password=DATABASE_PASSWORD,
        database=DATABASE_NAME,
        query={"host": nos},
    )


DATABASE_URL = _url(NOS)


def _criar_engine(url: URL, atributos: str, **opcoes):
    # tcp_user_timeout desiste de uma ligação cujo nó desapareceu, em vez de ficar à espera.
    return create_engine(
        url,
        pool_pre_ping=True,
        connect_args={
            "target_session_attrs": atributos,
            "connect_timeout": 2,
            "tcp_user_timeout": 2000,
        },
        **opcoes,
    )


engine = _criar_engine(DATABASE_URL, "read-write")
engine_leitura = _criar_engine(_url(NOS_LEITURA), "prefer-standby")
# Sem pool: fechar a ligação fecha-a mesmo, e com ela os advisory locks de sessão
# (a liderança do app/worker.py). Uma ligação devolvida ao pool mantinha-os.
engine_sem_pool = _criar_engine(DATABASE_URL, "read-write", poolclass=NullPool)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)
SessionLeitura = sessionmaker(bind=engine_leitura, autocommit=False, autoflush=False)


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


def obter_sessao_leitura():
    """Como obter_sessao, mas na réplica: só para pedidos que não escrevem."""
    sessao = SessionLeitura()
    try:
        yield sessao
    finally:
        sessao.close()
