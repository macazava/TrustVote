"""Configuração do backend, lida das variáveis de ambiente (definidas no compose.yaml / .env)."""
import os
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from sqlalchemy.engine import URL


def _ler_ficheiro_ou_env(nome: str) -> str | None:
    """Lê NOME do ambiente ou, se existir NOME_FILE, do ficheiro indicado (Docker secrets)."""
    caminho = os.getenv(f"{nome}_FILE")
    if caminho:
        return Path(caminho).read_text(encoding="utf-8").strip()
    return os.getenv(nome)


@dataclass(frozen=True)
class Settings:
    database_url: URL | str
    database_schema: str | None
    jwt_private_key: str
    jwt_public_key: str
    jwt_issuer: str
    jwt_minutos: int
    totp_encryption_key: str
    totp_issuer: str
    app_instance: str


@lru_cache
def get_settings() -> Settings:
    database_url = os.getenv("DATABASE_URL") or URL.create(
        "postgresql+psycopg2",
        username=os.getenv("DATABASE_USER", "trustvote"),
        password=os.getenv("DATABASE_PASSWORD", ""),
        host=os.getenv("DATABASE_HOST", "127.0.0.1"),
        port=int(os.getenv("DATABASE_PORT", "5432")),
        database=os.getenv("DATABASE_NAME", "trustvote"),
    )
    private_key = _ler_ficheiro_ou_env("JWT_PRIVATE_KEY")
    public_key = _ler_ficheiro_ou_env("JWT_PUBLIC_KEY")
    totp_key = _ler_ficheiro_ou_env("TOTP_ENCRYPTION_KEY")
    em_falta = [n for n, v in (("JWT_PRIVATE_KEY", private_key), ("JWT_PUBLIC_KEY", public_key),
                               ("TOTP_ENCRYPTION_KEY", totp_key)) if not v]
    if em_falta:
        raise RuntimeError(
            f"Configuração em falta: {', '.join(em_falta)} (ou *_FILE). "
            "Gerar com: python -m app.scripts.gerar_segredos <pasta>"
        )
    return Settings(
        database_url=database_url,
        database_schema=os.getenv("DATABASE_SCHEMA") or None,
        jwt_private_key=private_key,
        jwt_public_key=public_key,
        jwt_issuer=os.getenv("JWT_ISSUER", "trustvote"),
        jwt_minutos=int(os.getenv("JWT_MINUTOS", "30")),
        totp_encryption_key=totp_key,
        totp_issuer=os.getenv("TOTP_ISSUER", "TrustVote"),
        app_instance=os.getenv("APP_INSTANCE", "local"),
    )
