"""Acesso à tabela de eleições."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.eleicao import Eleicao
from app.models.habilitacao import Habilitacao


def criar(
    sessao: Session, titulo: str, descricao: str | None, criador_id: int
) -> Eleicao:
    eleicao = Eleicao(titulo=titulo, descricao=descricao, criador_id=criador_id)
    sessao.add(eleicao)
    sessao.commit()
    sessao.refresh(eleicao)
    return eleicao


def obter_por_id(sessao: Session, eleicao_id: int) -> Eleicao | None:
    return sessao.get(Eleicao, eleicao_id)


def listar(
    sessao: Session, estado: str | None = None, limite: int = 100
) -> list[Eleicao]:
    consulta = select(Eleicao)
    if estado is not None:
        consulta = consulta.where(Eleicao.estado == estado)
    return list(sessao.scalars(consulta.order_by(Eleicao.id).limit(limite)))


def listar_para_eleitor(
    sessao: Session, utilizador_id: int, estado: str | None = None, limite: int = 100
) -> list[Eleicao]:
    """Eleições publicadas em que o utilizador está habilitado."""
    consulta = (
        select(Eleicao)
        .join(Habilitacao, Habilitacao.eleicao_id == Eleicao.id)
        .where(Habilitacao.utilizador_id == utilizador_id, Eleicao.estado != "rascunho")
    )
    if estado is not None:
        consulta = consulta.where(Eleicao.estado == estado)
    return list(sessao.scalars(consulta.order_by(Eleicao.id).limit(limite)))


def listar_para_habilitacao(sessao: Session, limite: int = 1000) -> list[Eleicao]:
    """Eleições em que um novo eleitor pode votar: ainda não encerradas."""
    return list(
        sessao.scalars(
            select(Eleicao)
            .where(Eleicao.estado != "encerrada")
            .order_by(Eleicao.id)
            .limit(limite)
        )
    )
