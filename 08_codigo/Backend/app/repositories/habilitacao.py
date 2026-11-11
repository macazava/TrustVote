"""Acesso à tabela de habilitações (quem pode votar em cada eleição)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.habilitacao import Habilitacao
from app.models.utilizador import Utilizador


def criar(sessao: Session, eleicao_id: int, utilizador_id: int) -> Habilitacao:
    linha = Habilitacao(eleicao_id=eleicao_id, utilizador_id=utilizador_id)
    sessao.add(linha)
    sessao.commit()
    sessao.refresh(linha)
    return linha


def obter(sessao: Session, eleicao_id: int, utilizador_id: int) -> Habilitacao | None:
    return sessao.get(Habilitacao, (eleicao_id, utilizador_id))


def contar(sessao: Session, eleicao_id: int) -> int:
    return sessao.scalar(
        select(func.count())
        .select_from(Habilitacao)
        .where(Habilitacao.eleicao_id == eleicao_id)
    )


def listar_com_utilizador(
    sessao: Session, eleicao_id: int
) -> list[tuple[Habilitacao, Utilizador]]:
    """Caderno eleitoral: cada habilitação com os dados da pessoa."""
    return list(
        sessao.execute(
            select(Habilitacao, Utilizador)
            .join(Utilizador, Utilizador.id == Habilitacao.utilizador_id)
            .where(Habilitacao.eleicao_id == eleicao_id)
            .order_by(Utilizador.nome_utilizador)
        ).tuples()
    )


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
