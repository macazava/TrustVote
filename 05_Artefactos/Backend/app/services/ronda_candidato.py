"""Regras de negócio dos candidatos que concorrem em cada ronda."""

from sqlalchemy.orm import Session

from app.erros import DadosInvalidosError, NaoEncontradoError, RegistoDuplicadoError
from app.models.ronda_candidato import RondaCandidato
from app.repositories import candidato as repositorio_candidato
from app.repositories import ronda as repositorio_ronda
from app.repositories import ronda_candidato as repositorio
from app.schemas.ronda_candidato import RondaCandidatoCriar


def criar_ronda_candidato(
    sessao: Session, dados: RondaCandidatoCriar
) -> RondaCandidato:
    """Junta um candidato a uma ronda da eleição a que ele pertence."""
    ronda = repositorio_ronda.obter_por_id(sessao, dados.ronda_id)
    if ronda is None:
        raise NaoEncontradoError(f"Não existe a ronda {dados.ronda_id}.")

    candidato = repositorio_candidato.obter_por_id(sessao, dados.candidato_id)
    if candidato is None:
        raise NaoEncontradoError(f"Não existe o candidato {dados.candidato_id}.")

    if candidato.eleicao_id != ronda.eleicao_id:
        raise DadosInvalidosError("O candidato não pertence à eleição desta ronda.")

    if repositorio.obter(sessao, dados.ronda_id, dados.candidato_id) is not None:
        raise RegistoDuplicadoError("Esse candidato já concorre nesta ronda.")

    return repositorio.criar(
        sessao, ronda_id=dados.ronda_id, candidato_id=dados.candidato_id
    )


def listar_ronda_candidatos(
    sessao: Session, ronda_id: int | None = None
) -> list[RondaCandidato]:
    return repositorio.listar(sessao, ronda_id=ronda_id)
