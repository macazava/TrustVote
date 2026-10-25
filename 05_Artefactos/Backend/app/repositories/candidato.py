"""Acesso à tabela de candidatos."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.candidato import Candidato


def criar(
    sessao: Session,
    eleicao_id: int,
    nome: str,
    partido: str | None,
    descricao: str | None,
) -> Candidato:
    candidato = Candidato(
        eleicao_id=eleicao_id, nome=nome, partido=partido, descricao=descricao
    )
    sessao.add(candidato)
    sessao.commit()
    sessao.refresh(candidato)
    return candidato


def obter_por_id(sessao: Session, candidato_id: int) -> Candidato | None:
    return sessao.get(Candidato, candidato_id)


def listar(
    sessao: Session, eleicao_id: int | None = None, limite: int = 100
) -> list[Candidato]:
    consulta = select(Candidato)
    if eleicao_id is not None:
        consulta = consulta.where(Candidato.eleicao_id == eleicao_id)
    consulta = consulta.order_by(Candidato.id).limit(limite)
    return list(sessao.scalars(consulta))
