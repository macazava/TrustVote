"""Acesso à tabela de eleições."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.eleicao import Eleicao


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


def listar(sessao: Session, limite: int = 100) -> list[Eleicao]:
    return list(sessao.scalars(select(Eleicao).order_by(Eleicao.id).limit(limite)))


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
