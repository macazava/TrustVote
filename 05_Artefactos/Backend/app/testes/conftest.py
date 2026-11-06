"""Preparação dos testes.

Os testes usam o PostgreSQL de desenvolvimento (o do Backend/.env), mas num
esquema próprio (`teste_pytest`), criado a partir do trustvote.sql no início e
apagado no fim: os dados reais não são tocados. Sem base de dados, os testes
são saltados.

    cd Backend
    ..\\.venv\\Scripts\\python.exe -m pytest
"""

import os
from pathlib import Path

# Antes de importar a aplicação: segredo de teste e sem tarefas em segundo plano.
os.environ.setdefault("JWT_SECRET", "segredo-dos-testes-trustvote-0123456789")
os.environ["TAREFAS_INTERVALO"] = "0"
os.environ.pop("REDIS_HOST", None)
os.environ.pop("REDIS_SENTINELS", None)

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, text  # noqa: E402
from sqlalchemy.exc import OperationalError  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from app import migracoes  # noqa: E402
from app.database import DATABASE_URL, obter_sessao, obter_sessao_leitura  # noqa: E402
from main import app  # noqa: E402

ESQUEMA = "teste_pytest"
SQL = Path(__file__).resolve().parents[2] / "basedados/trustvote.sql"
PASSWORD = "palavra-passe-1"


@pytest.fixture(scope="session")
def motor():
    base = create_engine(DATABASE_URL, connect_args={"connect_timeout": 2})
    try:
        with base.begin() as conexao:
            conexao.execute(text(f"DROP SCHEMA IF EXISTS {ESQUEMA} CASCADE"))
            conexao.execute(text(f"CREATE SCHEMA {ESQUEMA}"))
    except OperationalError as erro:
        pytest.skip(f"Sem base de dados para os testes: {erro.orig}")

    motor = create_engine(
        DATABASE_URL, connect_args={"options": f"-csearch_path={ESQUEMA}"}
    )
    # Script com vários comandos: vai direto ao cursor do psycopg2, sem parâmetros.
    conexao = motor.raw_connection()
    try:
        with conexao.cursor() as cursor:
            # Só as tabelas: a parte das contas usa comandos do psql e é só para o Docker
            tabelas = SQL.read_text(encoding="utf-8").split("SET ROLE trustvote;", 1)[1]
            cursor.execute(tabelas)
        conexao.commit()
    finally:
        conexao.close()
    # Depois as migrações, como no Docker: os testes correm sobre o esquema real e atual
    migracoes.aplicar(motor, chave=migracoes.CHAVE_LOCK + 9_000)
    yield motor
    motor.dispose()
    with base.begin() as conexao:
        conexao.execute(text(f"DROP SCHEMA {ESQUEMA} CASCADE"))
    base.dispose()


@pytest.fixture
def Sessao(motor):
    with motor.begin() as conexao:
        tabelas = conexao.scalars(
            text("SELECT tablename FROM pg_tables WHERE schemaname = :e AND tablename <> 'schema_migracao'"), {"e": ESQUEMA}
        ).all()
        conexao.execute(text(f"TRUNCATE {', '.join(tabelas)} RESTART IDENTITY CASCADE"))
    return sessionmaker(bind=motor, autoflush=False)


@pytest.fixture
def cliente(Sessao):
    def sessao_de_teste():
        sessao = Sessao()
        try:
            yield sessao
        finally:
            sessao.close()

    app.dependency_overrides[obter_sessao] = sessao_de_teste
    app.dependency_overrides[obter_sessao_leitura] = sessao_de_teste
    with TestClient(app) as cliente:
        yield cliente
    app.dependency_overrides.clear()


@pytest.fixture
def sql(motor):
    """Corre SQL diretamente (para simular adulterações ou mudar datas)."""

    def executar(consulta: str, **parametros):
        with motor.begin() as conexao:
            return conexao.execute(text(consulta), parametros)

    return executar


# ===== Ajudas =====
def cabecalho(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


def registar(cliente, nome: str, numero: str | None = None) -> dict:
    resposta = cliente.post(
        "/auth/register",
        json={
            "nome_utilizador": nome,
            "email": f"{nome}@ex.pt",
            "num_estudante": numero or f"A{abs(hash(nome)) % 10**8:08d}",
            "curso": "Engenharia",
            "password": PASSWORD,
        },
    )
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def entrar(cliente, nome: str, **extra) -> str:
    resposta = cliente.post(
        "/auth/login", json={"email": f"{nome}@ex.pt", "password": PASSWORD, **extra}
    )
    assert resposta.status_code == 200, resposta.text
    return resposta.json()["access_token"]


@pytest.fixture
def admin(cliente, sql):
    """Token de um administrador."""
    registar(cliente, "admin")
    sql("UPDATE utilizador SET ut_perfil = 'administrador' WHERE ut_nome = 'admin'")
    return entrar(cliente, "admin")


@pytest.fixture
def eleicao_em_curso(cliente, admin):
    """Eleição com 2 candidatos, 3 eleitores habilitados e a 1.ª volta aberta."""
    from datetime import datetime, timedelta, timezone

    for nome in ("ana", "bruno", "carla"):
        registar(cliente, nome)
    h = cabecalho(admin)
    eleicao = cliente.post("/eleicoes", json={"titulo": "Direção AE", "quorum": 50}, headers=h).json()
    agora = datetime.now(timezone.utc)
    cliente.post(
        f"/eleicoes/{eleicao['id']}/rondas",
        json={
            "data_inicio": (agora - timedelta(hours=1)).isoformat(),
            "data_fim": (agora + timedelta(hours=1)).isoformat(),
        },
        headers=h,
    ).raise_for_status()
    candidatos = [
        cliente.post(f"/eleicoes/{eleicao['id']}/candidatos", json={"nome": n}, headers=h).json()["id"]
        for n in ("Lista A", "Lista B")
    ]
    eleitores = [u["id"] for u in cliente.get("/utilizadores?perfil=eleitor", headers=h).json()]
    cliente.post(
        f"/eleicoes/{eleicao['id']}/habilitados", json={"utilizador_ids": eleitores}, headers=h
    ).raise_for_status()
    assert cliente.post(f"/eleicoes/{eleicao['id']}/agendar", headers=h).status_code == 200
    assert cliente.post(f"/eleicoes/{eleicao['id']}/iniciar", headers=h).status_code == 200
    return {"id": eleicao["id"], "candidatos": candidatos}
