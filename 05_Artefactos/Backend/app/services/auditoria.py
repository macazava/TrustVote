"""Registo de operações relevantes na tabela auditoria (RF11).

O registo é adicionado à mesma transação da operação: se a operação falhar e fizer
rollback, o registo também não fica (não há auditoria de ações que não aconteceram).
"""
from sqlalchemy.orm import Session

from app.models import Auditoria


def registar(db: Session, acao: str, *, utilizador_id: int | None = None, entidade: str | None = None,
             entidade_id: int | None = None, detalhes: dict | None = None, ip: str | None = None) -> None:
    db.add(Auditoria(acao=acao, utilizador_id=utilizador_id, entidade=entidade, entidade_id=entidade_id,
                     detalhes=detalhes, ip=ip))
