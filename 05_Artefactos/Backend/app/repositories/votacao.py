"""Acesso às tabelas de participação, de votos e de resultados."""

import uuid
from datetime import datetime

from sqlalchemy import delete, func, select, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.participacao import Participacao
from app.models.resultado import Resultado
from app.models.ronda import Ronda
from app.models.voto import Voto


class VotoRepetidoError(Exception):
    """Este utilizador já tem participação registada nesta ronda."""


def registar_voto(
    sessao: Session,
    voto_id: uuid.UUID,
    ronda_id: int,
    utilizador_id: int,
    candidato_id: int | None,
    hash_voto: str,
    integridade: str,
) -> None:
    """Grava a participação e o voto na mesma transação: ou ficam os dois ou nenhum."""
    sessao.add(Participacao(ronda_id=ronda_id, utilizador_id=utilizador_id))
    try:
        sessao.flush()
    except IntegrityError as erro:
        sessao.rollback()
        raise VotoRepetidoError from erro

    sessao.add(
        Voto(
            id=voto_id,
            ronda_id=ronda_id,
            candidato_id=candidato_id,
            hash=hash_voto,
            integridade=integridade,
        )
    )
    sessao.commit()


def ja_votou(sessao: Session, ronda_id: int, utilizador_id: int) -> bool:
    consulta = select(Participacao.id).where(
        Participacao.ronda_id == ronda_id,
        Participacao.utilizador_id == utilizador_id,
    )
    return sessao.scalar(consulta) is not None


def obter_voto_por_hash(sessao: Session, hash_voto: str) -> Voto | None:
    return sessao.scalar(select(Voto).where(Voto.hash == hash_voto))


def listar_votos(sessao: Session, ronda_id: int):
    """Todos os votos de uma ronda, lidos aos poucos (para verificar os selos)."""
    return sessao.scalars(
        select(Voto).where(Voto.ronda_id == ronda_id).execution_options(yield_per=1000)
    )


def contar_votos_na_urna(sessao: Session, ronda_id: int) -> int:
    return sessao.scalar(
        select(func.count()).select_from(Voto).where(Voto.ronda_id == ronda_id)
    )


def baralhar_votos(sessao: Session, ronda_id: int) -> None:
    """Regrava os votos da ronda por ordem aleatória, na transação de quem chama.

    Enquanto a volta está aberta, a ordem física dos votos (e o xmin, partilhado com a
    participação gravada na mesma transação) segue a ordem de chegada; regravados,
    deixam de poder ser cruzados com a hora de cada participação.
    """
    sessao.execute(
        text(
            "WITH apagados AS (DELETE FROM voto WHERE vot_ron_id = :ronda RETURNING *) "
            "INSERT INTO voto SELECT * FROM apagados ORDER BY random()"
        ),
        {"ronda": ronda_id},
    )


def contar_participacoes(sessao: Session, ronda_id: int) -> int:
    return sessao.scalar(
        select(func.count()).select_from(Participacao).where(Participacao.ronda_id == ronda_id)
    )


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


# ===== Resultados apurados =====
def substituir_resultados(sessao: Session, ronda_id: int, linhas: list[Resultado]) -> None:
    """Troca o apuramento da ronda. Não grava: quem chama faz o commit."""
    sessao.execute(delete(Resultado).where(Resultado.ronda_id == ronda_id))
    sessao.add_all(linhas)


def listar_resultados(sessao: Session, ronda_id: int) -> list[Resultado]:
    return list(sessao.scalars(select(Resultado).where(Resultado.ronda_id == ronda_id)))


def ultimo_apuramento(sessao: Session, ronda_ids: list[int]) -> datetime | None:
    """Quando foi apurada a última destas rondas (None se nenhuma foi apurada)."""
    if not ronda_ids:
        return None
    return sessao.scalar(
        select(func.max(Resultado.apurado_em)).where(Resultado.ronda_id.in_(ronda_ids))
    )
