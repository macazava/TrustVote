"""Registo de auditoria (RF11): quem fez o quê, sobre o quê e quando.

Os registos formam uma cadeia: cada um guarda o hash do anterior e o seu
próprio hash, calculado sobre todos os campos. `verificar_cadeia` recalcula a
cadeia e indica o primeiro registo adulterado ou em falta.

Nunca se regista em quem um eleitor votou: o voto não passa por aqui.
"""

import hashlib
import json
import logging
from datetime import datetime, timezone

from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.auditoria import Auditoria
from app.repositories import auditoria as repositorio
from app.schemas.auditoria import VerificacaoCadeia

log = logging.getLogger("trustvote.auditoria")


def _hash(anterior: str | None, registo: Auditoria) -> str:
    conteudo = {
        "anterior": anterior,
        "utilizador_id": registo.utilizador_id,
        "acao": registo.acao,
        "entidade": registo.entidade,
        "entidade_id": registo.entidade_id,
        "detalhes": registo.detalhes,
        "ip": registo.ip,
        # Em UTC: a BD pode devolver a data noutro fuso horário.
        "data": registo.data.astimezone(timezone.utc).isoformat(),
    }
    texto = json.dumps(conteudo, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(texto.encode()).hexdigest()


def registar(
    sessao: Session,
    acao: str,
    utilizador_id: int | None = None,
    entidade: str | None = None,
    entidade_id: int | None = None,
    detalhes: dict | None = None,
    ip: str | None = None,
) -> None:
    """Acrescenta um registo à cadeia. Uma falha aqui não desfaz a ação já gravada."""
    registo = Auditoria(
        utilizador_id=utilizador_id,
        acao=acao,
        entidade=entidade,
        entidade_id=entidade_id,
        # Ida e volta pelo JSON, para o hash ser calculado sobre o que a BD guarda.
        detalhes=json.loads(json.dumps(detalhes, default=str)) if detalhes else None,
        ip=ip,
        data=datetime.now(timezone.utc),
    )
    try:
        repositorio.bloquear_cadeia(sessao)
        registo.hash_anterior = repositorio.ultimo_hash(sessao)
        registo.hash_atual = _hash(registo.hash_anterior, registo)
        repositorio.criar(sessao, registo)
    except SQLAlchemyError:
        sessao.rollback()
        log.exception("Não foi possível gravar o registo de auditoria %r.", acao)


def listar(sessao: Session, limite: int = 200) -> list[Auditoria]:
    return repositorio.listar(sessao, limite=limite)


def verificar_cadeia(sessao: Session) -> VerificacaoCadeia:
    anterior = None
    total = 0
    for registo in repositorio.todos_por_ordem(sessao):
        total += 1
        if registo.hash_anterior != anterior or registo.hash_atual != _hash(
            anterior, registo
        ):
            return VerificacaoCadeia(valida=False, total=total, primeiro_invalido=registo.id)
        anterior = registo.hash_atual
    return VerificacaoCadeia(valida=True, total=total, primeiro_invalido=None)


class Auditor:
    """Regista ações em nome de quem fez o pedido (ver security/dependencias.py)."""

    def __init__(self, sessao: Session, utilizador_id: int | None, ip: str | None):
        self.sessao = sessao
        self.utilizador_id = utilizador_id
        self.ip = ip

    def __call__(
        self,
        acao: str,
        entidade: str | None = None,
        entidade_id: int | None = None,
        **detalhes,
    ) -> None:
        registar(
            self.sessao,
            acao,
            utilizador_id=self.utilizador_id,
            entidade=entidade,
            entidade_id=entidade_id,
            detalhes=detalhes or None,
            ip=self.ip,
        )
