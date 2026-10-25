"""Configuração dos testes.

Os testes usam o PostgreSQL real (o da infraestrutura Docker, publicado em 127.0.0.1:15432 pelo
compose.debug.yaml), mas num schema próprio `tv_testes`, recriado a partir do trustvote.sql.
Os dados da aplicação (schema public) nunca são tocados.

Ligação: TEST_DATABASE_URL, ou por omissão trustvote@127.0.0.1:15432 com a password
TRUSTVOTE_DB_PASSWORD lida de 05_Artefactos/Infraestrutura/.env.
"""
import base64
import os
from pathlib import Path

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import create_engine, text
from sqlalchemy.engine import URL

BACKEND = Path(__file__).resolve().parents[2]
SQL_ESQUEMA = BACKEND / "config" / "database" / "init" / "docker_sql_and_sh" / "trustvote.sql"
ENV_INFRA = BACKEND.parent / "Infraestrutura" / ".env"
SCHEMA = "tv_testes"
TABELAS = "auditoria, resultado, voto, participacao, habilitacao, ronda_candidato, candidato, ronda, eleicao, utilizador"


def _url_testes() -> URL | str:
    if os.getenv("TEST_DATABASE_URL"):
        return os.environ["TEST_DATABASE_URL"]
    password = ""
    if ENV_INFRA.exists():
        for linha in ENV_INFRA.read_text(encoding="utf-8", errors="ignore").splitlines():
            if linha.startswith("TRUSTVOTE_DB_PASSWORD="):
                password = linha.split("=", 1)[1].strip()
    return URL.create("postgresql+psycopg2", username="trustvote", password=password,
                      host="127.0.0.1", port=15432, database="trustvote")


def _pem_rsa() -> tuple[str, str]:
    chave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    privada = chave.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                  serialization.NoEncryption()).decode()
    publica = chave.public_key().public_bytes(serialization.Encoding.PEM,
                                              serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    return privada, publica


# Configuração definida ANTES de importar a aplicação (get_settings é lido uma vez e guardado em cache)
_privada, _publica = _pem_rsa()
os.environ.update({
    "JWT_PRIVATE_KEY": _privada,
    "JWT_PUBLIC_KEY": _publica,
    "TOTP_ENCRYPTION_KEY": base64.b64encode(os.urandom(32)).decode(),
    "DATABASE_SCHEMA": SCHEMA,
    "APP_INSTANCE": "testes",
})
_url = _url_testes()
os.environ["DATABASE_URL"] = _url if isinstance(_url, str) else _url.render_as_string(hide_password=False)


@pytest.fixture(scope="session", autouse=True)
def esquema_testes():
    engine = create_engine(os.environ["DATABASE_URL"])
    try:
        with engine.connect() as c:
            c.execute(text("SELECT 1"))
    except Exception as e:  # noqa: BLE001
        pytest.exit(f"PostgreSQL de testes indisponível ({e.__class__.__name__}). Arranque a infraestrutura com "
                    "compose.debug.yaml ou defina TEST_DATABASE_URL.", returncode=2)
    sql = "\n".join(l for l in SQL_ESQUEMA.read_text(encoding="utf-8").splitlines()
                    if not l.strip().upper().startswith("SET ROLE"))
    with engine.begin() as c:
        c.execute(text(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE"))
        c.execute(text(f"CREATE SCHEMA {SCHEMA}"))
        c.execute(text(f"SET LOCAL search_path TO {SCHEMA}"))
        c.exec_driver_sql(sql)
    yield
    with engine.begin() as c:
        c.execute(text(f"DROP SCHEMA IF EXISTS {SCHEMA} CASCADE"))
    engine.dispose()


@pytest.fixture(autouse=True)
def limpar_tabelas(esquema_testes):
    from app.database import get_engine
    with get_engine().begin() as c:
        c.execute(text(f"TRUNCATE {TABELAS} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def db():
    from app.database import get_session_factory
    with get_session_factory()() as s:
        yield s


@pytest.fixture
def client():
    from fastapi.testclient import TestClient

    from main import app
    with TestClient(app) as c:
        yield c


PASSWORD = "Password123"


@pytest.fixture
def criar_utilizador(db):
    """Cria um utilizador diretamente pelo service e devolve-o."""
    from app.services import autenticacao

    def _criar(email: str, perfil: str = "eleitor", nome: str = "Utilizador Teste"):
        return autenticacao.registar(db, nome, email, PASSWORD, perfil=perfil)
    return _criar


@pytest.fixture
def login(client):
    def _login(email: str, password: str = PASSWORD, codigo_totp: str | None = None) -> dict:
        r = client.post("/auth/login", json={"email": email, "password": password, "codigo_totp": codigo_totp})
        assert r.status_code == 200, r.text
        return {"Authorization": f"Bearer {r.json()['access_token']}"}
    return _login


@pytest.fixture
def admin(criar_utilizador, login):
    u = criar_utilizador("admin@teste.pt", perfil="administrador", nome="Admin")
    return u, login("admin@teste.pt")


@pytest.fixture
def eleitor(criar_utilizador, login):
    u = criar_utilizador("eleitor@teste.pt", nome="Eleitor")
    return u, login("eleitor@teste.pt")
