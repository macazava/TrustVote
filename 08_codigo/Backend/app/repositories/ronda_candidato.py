"""Acesso à tabela `ronda_candidato` (quem concorre em cada ronda)."""

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models.candidato import Candidato
from app.models.ronda_candidato import RondaCandidato


def criar(sessao: Session, ronda_id: int, candidato_id: int) -> RondaCandidato:
    linha = RondaCandidato(ronda_id=ronda_id, candidato_id=candidato_id)
    sessao.add(linha)
    sessao.commit()
    sessao.refresh(linha)
    return linha


def substituir(sessao: Session, ronda_id: int, candidato_ids: list[int]) -> None:
    """Define quem concorre na ronda. Só pode ser usado antes de haver votos."""
    sessao.execute(delete(RondaCandidato).where(RondaCandidato.ronda_id == ronda_id))
    sessao.add_all(
        RondaCandidato(ronda_id=ronda_id, candidato_id=candidato_id)
        for candidato_id in candidato_ids
    )
    sessao.commit()


def listar_candidatos(sessao: Session, ronda_id: int) -> list[Candidato]:
    return list(
        sessao.scalars(
            select(Candidato)
            .join(RondaCandidato, RondaCandidato.candidato_id == Candidato.id)
            .where(RondaCandidato.ronda_id == ronda_id)
            .order_by(Candidato.id)
        )
    )


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
