"""Acesso à tabela de rondas."""

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.ronda import Ronda


def criar(
    sessao: Session,
    eleicao_id: int,
    numero: int,
    data_inicio: datetime,
    data_fim: datetime,
) -> Ronda:
    ronda = Ronda(
        eleicao_id=eleicao_id,
        numero=numero,
        data_inicio=data_inicio,
        data_fim=data_fim,
    )
    sessao.add(ronda)
    sessao.commit()
    sessao.refresh(ronda)
    return ronda


def obter_por_id(sessao: Session, ronda_id: int) -> Ronda | None:
    return sessao.get(Ronda, ronda_id)


def obter_por_eleicao_e_numero(
    sessao: Session, eleicao_id: int, numero: int
) -> Ronda | None:
    return sessao.scalar(
        select(Ronda).where(Ronda.eleicao_id == eleicao_id, Ronda.numero == numero)
    )


def listar(
    sessao: Session, eleicao_id: int | None = None, limite: int = 100
) -> list[Ronda]:
    consulta = select(Ronda)
    if eleicao_id is not None:
        consulta = consulta.where(Ronda.eleicao_id == eleicao_id)
    consulta = consulta.order_by(Ronda.id).limit(limite)
    return list(sessao.scalars(consulta))
