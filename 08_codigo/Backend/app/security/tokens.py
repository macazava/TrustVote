"""Tokens de acesso: criação e leitura (JWT assinado com HS256).

O segredo vem da variável de ambiente JWT_SECRET, que é obrigatória: sem ela a
API não arranca, porque um segredo conhecido permitiria forjar tokens.

Cada token tem um `jti` aleatório; o logout guarda-o no Redis até o token
expirar (app/cache.py), para deixar de ser aceite.
"""

import os
import secrets
from datetime import datetime, timedelta, timezone

import jwt
from dotenv import load_dotenv

from app.models.utilizador import Utilizador

load_dotenv()

ALGORITMO = "HS256"
SEGREDO = os.getenv("JWT_SECRET", "")
MINUTOS_VALIDADE = int(os.getenv("JWT_MINUTOS_VALIDADE", "60"))

if len(SEGREDO) < 16:
    raise RuntimeError(
        "Defina JWT_SECRET (pelo menos 16 caracteres) no .env antes de arrancar a API."
    )


class TokenInvalidoError(Exception):
    """O token falta, expirou ou tem uma assinatura inválida."""


def criar_token(utilizador: Utilizador) -> str:
    """Devolve um token que identifica o utilizador durante MINUTOS_VALIDADE."""
    agora = datetime.now(timezone.utc)
    conteudo = {
        "sub": str(utilizador.id),
        "nome_utilizador": utilizador.nome_utilizador,
        "perfil": utilizador.perfil,
        "iat": agora,
        "exp": agora + timedelta(minutes=MINUTOS_VALIDADE),
        "jti": secrets.token_hex(16),
    }
    return jwt.encode(conteudo, SEGREDO, algorithm=ALGORITMO)


def ler_token(token: str) -> dict:
    """Valida o token e devolve o seu conteúdo."""
    try:
        return jwt.decode(token, SEGREDO, algorithms=[ALGORITMO])
    except jwt.PyJWTError as erro:
        raise TokenInvalidoError("Token inválido ou expirado.") from erro


def segundos_restantes(conteudo: dict) -> int:
    """Quanto falta para o token expirar (usado para o guardar como revogado)."""
    return max(0, int(conteudo["exp"] - datetime.now(timezone.utc).timestamp()))
