"""Regras de negócio dos candidatos."""

from sqlalchemy.orm import Session

from app.erros import NaoEncontradoError
from app.models.candidato import Candidato
from app.repositories import candidato as repositorio
from app.repositories import eleicao as repositorio_eleicao
from app.schemas.candidato import CandidatoCriar


def criar_candidato(sessao: Session, dados: CandidatoCriar) -> Candidato:
    """Cria um candidato, depois de confirmar que a eleição existe."""
    if repositorio_eleicao.obter_por_id(sessao, dados.eleicao_id) is None:
        raise NaoEncontradoError(f"Não existe a eleição {dados.eleicao_id}.")

    return repositorio.criar(
        sessao,
        eleicao_id=dados.eleicao_id,
        nome=dados.nome,
        partido=dados.partido,
        descricao=dados.descricao,
    )


def obter_candidato(sessao: Session, candidato_id: int) -> Candidato:
    candidato = repositorio.obter_por_id(sessao, candidato_id)
    if candidato is None:
        raise NaoEncontradoError(f"Não existe o candidato {candidato_id}.")
    return candidato


def listar_candidatos(
    sessao: Session, eleicao_id: int | None = None
) -> list[Candidato]:
    return repositorio.listar(sessao, eleicao_id=eleicao_id)
