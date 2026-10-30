"""Acesso à tabela de habilitações (quem pode votar em cada eleição)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.habilitacao import Habilitacao


def criar(sessao: Session, eleicao_id: int, utilizador_id: int) -> Habilitacao:
    linha = Habilitacao(eleicao_id=eleicao_id, utilizador_id=utilizador_id)
    sessao.add(linha)
    sessao.commit()
    sessao.refresh(linha)
    return linha


def obter(sessao: Session, eleicao_id: int, utilizador_id: int) -> Habilitacao | None:
    return sessao.get(Habilitacao, (eleicao_id, utilizador_id))


def listar(
    sessao: Session, eleicao_id: int | None = None, limite: int = 100
) -> list[Habilitacao]:
    consulta = select(Habilitacao)
    if eleicao_id is not None:
        consulta = consulta.where(Habilitacao.eleicao_id == eleicao_id)
    consulta = consulta.order_by(
        Habilitacao.eleicao_id, Habilitacao.utilizador_id
    ).limit(limite)
    return list(sessao.scalars(consulta))
