"""Registo e consulta das operações relevantes (RF11), com encadeamento de hashes.

O registo é adicionado à mesma transação da operação: se a operação falhar e fizer
rollback, o registo também não fica (não há auditoria de ações que não aconteceram).

Encadeamento: cada registo guarda o hash do registo anterior. Para a cadeia ser linear mesmo
com duas instâncias a escrever ao mesmo tempo, o registo usa um advisory lock do PostgreSQL
(pg_advisory_xact_lock), libertado no fim da transação. Ordem de bloqueios no código: primeiro
a eleição/utilizador (FOR UPDATE), depois a auditoria — sempre a mesma, para não haver deadlocks.
"""
from datetime import datetime, timezone

from sqlalchemy import func, select, text
from sqlalchemy.orm import Session

from app.models import Auditoria
from app.security.integridade import hash_auditoria

_LOCK_AUDITORIA = 7_201_026  # identificador arbitrário do advisory lock da cadeia


def registar(db: Session, acao: str, *, utilizador_id: int | None = None, entidade: str | None = None,
             entidade_id: int | None = None, detalhes: dict | None = None, ip: str | None = None) -> None:
    db.execute(text("SELECT pg_advisory_xact_lock(:k)"), {"k": _LOCK_AUDITORIA})
    anterior = db.scalar(select(Auditoria.hash_atual).order_by(Auditoria.id.desc()).limit(1))
    registo = Auditoria(acao=acao, utilizador_id=utilizador_id, entidade=entidade, entidade_id=entidade_id,
                        detalhes=detalhes, ip=ip, hash_anterior=anterior,
                        data=datetime.now(timezone.utc))
    db.add(registo)
    db.flush()  # obtém o aud_id, que entra no hash
    registo.hash_atual = hash_auditoria(anterior, id=registo.id, acao=acao, utilizador_id=utilizador_id,
                                        entidade=entidade, entidade_id=entidade_id, detalhes=detalhes,
                                        ip=ip, data=registo.data)


def listar(db: Session, *, acao: str | None = None, utilizador_id: int | None = None,
           entidade: str | None = None, entidade_id: int | None = None,
           limite: int = 100, antes_de: int | None = None) -> list[Auditoria]:
    stmt = select(Auditoria).order_by(Auditoria.id.desc()).limit(limite)
    if acao:
        stmt = stmt.where(Auditoria.acao.like(acao.replace("*", "%")))
    if utilizador_id is not None:
        stmt = stmt.where(Auditoria.utilizador_id == utilizador_id)
    if entidade:
        stmt = stmt.where(Auditoria.entidade == entidade)
    if entidade_id is not None:
        stmt = stmt.where(Auditoria.entidade_id == entidade_id)
    if antes_de is not None:  # paginação: registos com id menor do que este
        stmt = stmt.where(Auditoria.id < antes_de)
    return list(db.scalars(stmt))


def verificar_cadeia(db: Session) -> dict:
    """Recalcula toda a cadeia. Devolve o primeiro registo onde a cadeia está quebrada, se existir.

    Registos sem hash no INÍCIO da tabela foram criados antes de existir o encadeamento e são
    contados à parte (sem_encadeamento). Um registo sem hash depois do início da cadeia é
    tratado como adulteração.
    """
    total = db.scalar(select(func.count()).select_from(Auditoria))
    anterior, cadeia_iniciada, antigos = None, False, 0
    for r in db.scalars(select(Auditoria).order_by(Auditoria.id).execution_options(yield_per=500)):
        if not cadeia_iniciada and r.hash_atual is None and r.hash_anterior is None:
            antigos += 1
            continue
        cadeia_iniciada = True
        esperado = hash_auditoria(anterior, id=r.id, acao=r.acao, utilizador_id=r.utilizador_id,
                                  entidade=r.entidade, entidade_id=r.entidade_id, detalhes=r.detalhes,
                                  ip=r.ip, data=r.data)
        if r.hash_anterior != anterior or r.hash_atual != esperado:
            return {"integra": False, "total": total, "sem_encadeamento": antigos, "primeiro_registo_invalido": r.id}
        anterior = r.hash_atual
    return {"integra": True, "total": total, "sem_encadeamento": antigos, "primeiro_registo_invalido": None}
