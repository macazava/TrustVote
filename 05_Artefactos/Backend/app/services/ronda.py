"""Regras de negócio das rondas."""

from sqlalchemy.orm import Session

from app.erros import DadosInvalidosError, NaoEncontradoError, RegistoDuplicadoError
from app.models.ronda import Ronda
from app.repositories import eleicao as repositorio_eleicao
from app.repositories import ronda as repositorio
from app.schemas.ronda import RondaCriar


def criar_ronda(sessao: Session, dados: RondaCriar) -> Ronda:
    """Cria uma ronda, validando a eleição, o período e a volta repetida."""
    if repositorio_eleicao.obter_por_id(sessao, dados.eleicao_id) is None:
        raise NaoEncontradoError(f"Não existe a eleição {dados.eleicao_id}.")

    if dados.data_fim <= dados.data_inicio:
        raise DadosInvalidosError("A data de fim tem de ser posterior à de início.")

    if (
        repositorio.obter_por_eleicao_e_numero(sessao, dados.eleicao_id, dados.numero)
        is not None
    ):
        raise RegistoDuplicadoError(
            f"A eleição {dados.eleicao_id} já tem a {dados.numero}.ª volta."
        )

    return repositorio.criar(
        sessao,
        eleicao_id=dados.eleicao_id,
        numero=dados.numero,
        data_inicio=dados.data_inicio,
        data_fim=dados.data_fim,
    )


def obter_ronda(sessao: Session, ronda_id: int) -> Ronda:
    ronda = repositorio.obter_por_id(sessao, ronda_id)
    if ronda is None:
        raise NaoEncontradoError(f"Não existe a ronda {ronda_id}.")
    return ronda


def listar_rondas(sessao: Session, eleicao_id: int | None = None) -> list[Ronda]:
    return repositorio.listar(sessao, eleicao_id=eleicao_id)
