"""Acesso à tabela `ronda_candidato` (quem concorre em cada ronda)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ronda_candidato import RondaCandidato


def criar(sessao: Session, ronda_id: int, candidato_id: int) -> RondaCandidato:
    linha = RondaCandidato(ronda_id=ronda_id, candidato_id=candidato_id)
    sessao.add(linha)
    sessao.commit()
    sessao.refresh(linha)
    return linha


def obter(
    sessao: Session, ronda_id: int, candidato_id: int
) -> RondaCandidato | None:
    return sessao.get(RondaCandidato, (ronda_id, candidato_id))


def listar(
    sessao: Session, ronda_id: int | None = None, limite: int = 100
) -> list[RondaCandidato]:
    consulta = select(RondaCandidato)
    if ronda_id is not None:
        consulta = consulta.where(RondaCandidato.ronda_id == ronda_id)
    consulta = consulta.order_by(
        RondaCandidato.ronda_id, RondaCandidato.candidato_id
    ).limit(limite)
    return list(sessao.scalars(consulta))
