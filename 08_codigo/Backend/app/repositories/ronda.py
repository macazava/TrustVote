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
    sessao: Session, eleicao_id: int, numero: int, bloqueio: str | None = None
) -> Ronda | None:
    """`bloqueio`: 'partilhado' (quem vota) ou 'exclusivo' (quem encerra).

    O voto segura a ronda em modo partilhado até ao commit; encerrar pede-a em
    modo exclusivo, por isso espera pelos votos em curso e o apuramento conta-os
    todos. Quem chegar depois já lê a ronda encerrada.
    """
    consulta = select(Ronda).where(Ronda.eleicao_id == eleicao_id, Ronda.numero == numero)
    if bloqueio == "partilhado":
        consulta = consulta.with_for_update(read=True)
    elif bloqueio == "exclusivo":
        consulta = consulta.with_for_update()
    # Com bloqueio, relê a linha mesmo que a sessão já a tenha em memória.
    if bloqueio:
        consulta = consulta.execution_options(populate_existing=True)
    return sessao.scalar(consulta)


def listar(
    sessao: Session,
    eleicao_id: int | None = None,
    limite: int = 100,
    bloquear: bool = False,
) -> list[Ronda]:
    consulta = select(Ronda)
    if eleicao_id is not None:
        consulta = consulta.where(Ronda.eleicao_id == eleicao_id)
    consulta = consulta.order_by(Ronda.id).limit(limite)
    if bloquear:
        consulta = consulta.with_for_update().execution_options(populate_existing=True)
    return list(sessao.scalars(consulta))


def listar_encerradas_por_apurar(sessao: Session) -> list[Ronda]:
    return list(sessao.scalars(select(Ronda).where(Ronda.estado == "encerrada")))


def bloquear_por_id(sessao: Session, ronda_id: int) -> Ronda | None:
    """A ronda em modo exclusivo, relida da BD (ver obter_por_eleicao_e_numero)."""
    consulta = (
        select(Ronda)
        .where(Ronda.id == ronda_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    return sessao.scalar(consulta)


def listar_abertas_expiradas(sessao: Session, agora: datetime) -> list[Ronda]:
    """Rondas abertas cujo fim já passou."""
    return list(
        sessao.scalars(
            select(Ronda).where(Ronda.estado == "aberta", Ronda.data_fim <= agora)
        )
    )


def listar_agendadas_a_abrir(sessao: Session, agora: datetime) -> list[Ronda]:
    """Rondas agendadas cujo período já começou e ainda não acabou."""
    return list(
        sessao.scalars(
            select(Ronda).where(
                Ronda.estado == "agendada",
                Ronda.data_inicio <= agora,
                Ronda.data_fim > agora,
            )
        )
    )
