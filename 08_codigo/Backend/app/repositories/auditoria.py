"""Acesso à tabela de auditoria."""

from sqlalchemy import select, text
from sqlalchemy.orm import Session

from app.models.auditoria import Auditoria

# Chave do advisory lock que põe em fila quem escreve na cadeia (várias instâncias da API).
_CHAVE_CADEIA = 7_240_011


def bloquear_cadeia(sessao: Session) -> None:
    """Até ao fim da transação, mais ninguém acrescenta registos à cadeia."""
    sessao.execute(text("SELECT pg_advisory_xact_lock(:chave)"), {"chave": _CHAVE_CADEIA})


def ultimo_hash(sessao: Session) -> str | None:
    return sessao.scalar(
        select(Auditoria.hash_atual).order_by(Auditoria.id.desc()).limit(1)
    )


def criar(sessao: Session, registo: Auditoria) -> Auditoria:
    sessao.add(registo)
    sessao.commit()
    return registo


def listar(sessao: Session, limite: int = 200) -> list[Auditoria]:
    """Os registos mais recentes primeiro."""
    return list(
        sessao.scalars(select(Auditoria).order_by(Auditoria.id.desc()).limit(limite))
    )


def todos_por_ordem(sessao: Session):
    """Todos os registos, do mais antigo para o mais recente, sem os carregar de uma vez."""
    return sessao.scalars(
        select(Auditoria).order_by(Auditoria.id).execution_options(yield_per=500)
    )
