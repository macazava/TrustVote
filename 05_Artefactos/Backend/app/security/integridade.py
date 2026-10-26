"""Integridade dos votos e da auditoria.

- Votos: vot_hash = HMAC-SHA256(chave, vot_id|ronda|candidato). Sem a chave não é possível
  alterar o candidato de um voto e recalcular um hash válido; o apuramento confirma cada voto.
- Auditoria: cada registo guarda o hash do anterior (aud_hash_anterior) e o seu próprio
  (aud_hash_atual = SHA-256 do anterior + conteúdo). Alterar ou apagar um registo antigo
  quebra a cadeia, e isso é detetado por /auditoria/verificar.

A chave dos votos é derivada (HKDF) da TOTP_ENCRYPTION_KEY com um rótulo próprio, para não
exigir mais um segredo. Trocar essa chave torna os votos já guardados não verificáveis.
"""
import base64
import hashlib
import hmac
import json
from datetime import datetime, timezone
from functools import lru_cache

from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.hkdf import HKDF

from app.config import get_settings


@lru_cache
def _chave_votos() -> bytes:
    base = base64.b64decode(get_settings().totp_encryption_key)
    return HKDF(algorithm=hashes.SHA256(), length=32, salt=None, info=b"trustvote-votos-v1").derive(base)


def hash_voto(voto_id: str, ronda_id: int, candidato_id: int) -> str:
    mensagem = f"{voto_id}|{ronda_id}|{candidato_id}".encode()
    return hmac.new(_chave_votos(), mensagem, hashlib.sha256).hexdigest()


def voto_valido(voto_id: str, ronda_id: int, candidato_id: int, guardado: str) -> bool:
    return hmac.compare_digest(hash_voto(voto_id, ronda_id, candidato_id), guardado or "")


def _data_iso(data: datetime) -> str:
    return data.astimezone(timezone.utc).isoformat(timespec="microseconds")


def hash_auditoria(hash_anterior: str | None, *, id: int, acao: str, utilizador_id: int | None,
                   entidade: str | None, entidade_id: int | None, detalhes: dict | None,
                   ip: str | None, data: datetime) -> str:
    conteudo = json.dumps({
        "anterior": hash_anterior, "id": id, "acao": acao, "utilizador_id": utilizador_id,
        "entidade": entidade, "entidade_id": entidade_id, "detalhes": detalhes, "ip": ip,
        "data": _data_iso(data),
    }, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(conteudo.encode()).hexdigest()
