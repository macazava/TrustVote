"""Selo de integridade dos votos (HMAC-SHA256).

O selo junta o id do voto, a ronda, o candidato e o hash do recibo, assinados
com um segredo que só o backend conhece. Quem altere um voto diretamente na BD
(por exemplo, trocar o candidato) ou insira um voto novo não consegue calcular
o selo certo, e o apuramento deixa de contar esse voto.

O segredo vem de VOTO_HMAC_SECRET; sem ela é derivado do JWT_SECRET.
"""

import hashlib
import hmac
import os
import uuid

from app.security.tokens import SEGREDO as SEGREDO_JWT

SEGREDO = (
    os.getenv("VOTO_HMAC_SECRET")
    or hmac.new(SEGREDO_JWT.encode(), b"trustvote-voto", hashlib.sha256).hexdigest()
).encode()


def selo(voto_id: uuid.UUID, ronda_id: int, candidato_id: int | None, hash_recibo: str) -> str:
    mensagem = f"{voto_id}|{ronda_id}|{candidato_id or 'branco'}|{hash_recibo}"
    return hmac.new(SEGREDO, mensagem.encode(), hashlib.sha256).hexdigest()


def selo_valido(voto) -> bool:
    """Diz se o voto (modelo Voto) tem o selo que o backend lhe deu."""
    if not voto.integridade:
        return False
    esperado = selo(voto.id, voto.ronda_id, voto.candidato_id, voto.hash)
    return hmac.compare_digest(esperado, voto.integridade)
