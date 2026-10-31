"""Acesso às tabelas de participação e de votos."""

from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.participacao import Participacao
from app.models.ronda import Ronda
from app.models.voto import Voto


class VotoRepetidoError(Exception):
    """Este utilizador já tem participação registada nesta ronda."""


def registar_voto(
    sessao: Session, ronda_id: int, utilizador_id: int, candidato_id: int, hash_voto: str
) -> None:
    """Grava a participação e o voto na mesma transação: ou ficam os dois ou nenhum."""
    sessao.add(Participacao(ronda_id=ronda_id, utilizador_id=utilizador_id))
    try:
        sessao.flush()
    except IntegrityError as erro:
        sessao.rollback()
        raise VotoRepetidoError from erro

    sessao.add(Voto(ronda_id=ronda_id, candidato_id=candidato_id, hash=hash_voto))
    sessao.commit()


def ja_votou(sessao: Session, ronda_id: int, utilizador_id: int) -> bool:
    consulta = select(Participacao.id).where(
        Participacao.ronda_id == ronda_id,
        Participacao.utilizador_id == utilizador_id,
    )
    return sessao.scalar(consulta) is not None


def obter_voto_por_hash(sessao: Session, hash_voto: str) -> Voto | None:
    return sessao.scalar(select(Voto).where(Voto.hash == hash_voto))


def contar_votos(sessao: Session, ronda_id: int) -> dict[int, int]:
    """Devolve {candidato_id: total de votos} de uma ronda."""
    linhas = sessao.execute(
        select(Voto.candidato_id, func.count())
        .where(Voto.ronda_id == ronda_id)
        .group_by(Voto.candidato_id)
    )
    return {candidato_id: total for candidato_id, total in linhas}


def contar_votantes(sessao: Session, eleicao_id: int) -> int:
    """Eleitores diferentes que votaram em pelo menos uma ronda da eleição."""
    return sessao.scalar(
        select(func.count(func.distinct(Participacao.utilizador_id)))
        .join(Ronda, Ronda.id == Participacao.ronda_id)
        .where(Ronda.eleicao_id == eleicao_id)
    )


def datas_de_participacao(
    sessao: Session, eleicao_id: int, desde: datetime
) -> list[datetime]:
    """Momentos em que houve voto: vêm da participação, porque o voto não tem data."""
    return list(
        sessao.scalars(
            select(Participacao.registada_em)
            .join(Ronda, Ronda.id == Participacao.ronda_id)
            .where(Ronda.eleicao_id == eleicao_id, Participacao.registada_em >= desde)
        )
    )
