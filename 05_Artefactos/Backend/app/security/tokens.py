"""Tokens de acesso: criação e leitura (JWT assinado com HS256).

O segredo vem da variável de ambiente JWT_SECRET. Sem ela usa-se um valor de
desenvolvimento: chega para testar, mas quem o conheça consegue forjar tokens,
por isso define JWT_SECRET antes de usar isto a sério.
"""

import os
from datetime import datetime, timedelta, timezone

import jwt

from app.models.utilizador import Utilizador

ALGORITMO = "HS256"
SEGREDO = os.getenv("JWT_SECRET", "dev-trustvote-segredo-nao-usar-em-producao")
MINUTOS_VALIDADE = int(os.getenv("JWT_MINUTOS_VALIDADE", "60"))


class TokenInvalidoError(Exception):
    """O token falta, expirou ou tem uma assinatura inválida."""


def criar_token(utilizador: Utilizador) -> str:
    """Devolve um token que identifica o utilizador durante MINUTOS_VALIDADE."""
    agora = datetime.now(timezone.utc)
    conteudo = {
        "sub": str(utilizador.id),
        "nome_utilizador": utilizador.nome_utilizador,
        "perfil": utilizador.perfil,
        "exp": agora + timedelta(minutes=MINUTOS_VALIDADE),
    }
    return jwt.encode(conteudo, SEGREDO, algorithm=ALGORITMO)


def ler_token(token: str) -> dict:
    """Valida o token e devolve o seu conteúdo."""
    try:
        return jwt.decode(token, SEGREDO, algorithms=[ALGORITMO])
    except jwt.PyJWTError as erro:
        raise TokenInvalidoError("Token inválido ou expirado.") from erro
