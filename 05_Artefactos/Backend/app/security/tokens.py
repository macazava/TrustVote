"""Tokens de acesso JWT assinados com RS256.

A chave privada só é usada para assinar e a pública para validar. As duas instâncias
(servidor1/servidor2) usam o MESMO par de chaves, por isso um token emitido por uma é
aceite pela outra (o nginx pode enviar pedidos seguidos para instâncias diferentes).
"""
import uuid
from datetime import datetime, timedelta, timezone

import jwt

from app.config import get_settings

ALGORITMO = "RS256"


class TokenInvalido(Exception):
    pass


def criar_token(utilizador_id: int, perfil: str) -> tuple[str, int]:
    """Devolve (token, segundos até expirar)."""
    s = get_settings()
    agora = datetime.now(timezone.utc)
    expira = agora + timedelta(minutes=s.jwt_minutos)
    payload = {
        "sub": str(utilizador_id),
        "perfil": perfil,
        "iss": s.jwt_issuer,
        "iat": agora,
        "nbf": agora,
        "exp": expira,
        "jti": uuid.uuid4().hex,
        # em milissegundos: permite revogar "todos os tokens emitidos até agora" sem apanhar
        # um token novo emitido no mesmo segundo
        "emitido_ms": int(agora.timestamp() * 1000),
    }
    return jwt.encode(payload, s.jwt_private_key, algorithm=ALGORITMO), s.jwt_minutos * 60


def validar_token(token: str) -> dict:
    s = get_settings()
    try:
        # algorithms fixo: impede ataques de troca de algoritmo (ex.: "none" ou HS256 com a chave pública)
        return jwt.decode(token, s.jwt_public_key, algorithms=[ALGORITMO], issuer=s.jwt_issuer,
                          options={"require": ["sub", "exp", "iat", "iss"]})
    except jwt.PyJWTError as e:
        raise TokenInvalido(str(e)) from e
