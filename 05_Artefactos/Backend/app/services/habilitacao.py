"""Regras de negócio das habilitações (quem pode votar em cada eleição)."""

from sqlalchemy.orm import Session

from app.erros import NaoEncontradoError, RegistoDuplicadoError
from app.models.habilitacao import Habilitacao
from app.repositories import eleicao as repositorio_eleicao
from app.repositories import habilitacao as repositorio
from app.repositories import utilizador as repositorio_utilizador
from app.schemas.habilitacao import HabilitacaoCriar


def criar_habilitacao(sessao: Session, dados: HabilitacaoCriar) -> Habilitacao:
    """Habilita um utilizador a votar numa eleição."""
    if repositorio_eleicao.obter_por_id(sessao, dados.eleicao_id) is None:
        raise NaoEncontradoError(f"Não existe a eleição {dados.eleicao_id}.")

    if repositorio_utilizador.obter_por_id(sessao, dados.utilizador_id) is None:
        raise NaoEncontradoError(f"Não existe o utilizador {dados.utilizador_id}.")

    if repositorio.obter(sessao, dados.eleicao_id, dados.utilizador_id) is not None:
        raise RegistoDuplicadoError(
            "Esse utilizador já está habilitado nesta eleição."
        )

    return repositorio.criar(
        sessao, eleicao_id=dados.eleicao_id, utilizador_id=dados.utilizador_id
    )


def listar_habilitacoes(
    sessao: Session, eleicao_id: int | None = None
) -> list[Habilitacao]:
    return repositorio.listar(sessao, eleicao_id=eleicao_id)
