"""Regras de negócio dos candidatos."""

from sqlalchemy.orm import Session

from app.database import apagar, gravar
from app.erros import NaoEncontradoError
from app.models.candidato import Candidato
from app.repositories import candidato as repositorio
from app.schemas.candidato import CandidatoAlterar, CandidatoCriar, CandidatoNovo
from app.services.eleicao import exigir_editavel, obter_eleicao


def criar_candidato(sessao: Session, dados: CandidatoCriar) -> Candidato:
    """Cria um candidato, depois de confirmar que a eleição existe."""
    exigir_editavel(obter_eleicao(sessao, dados.eleicao_id))

    return repositorio.criar(
        sessao,
        eleicao_id=dados.eleicao_id,
        nome=dados.nome,
        partido=dados.partido,
        orgao=dados.orgao,
        curso=dados.curso,
        ano=dados.ano,
        descricao=dados.descricao,
    )


def criar_candidato_na_eleicao(
    sessao: Session, eleicao_id: int, dados: CandidatoNovo
) -> Candidato:
    return criar_candidato(
        sessao, CandidatoCriar(**dados.model_dump(), eleicao_id=eleicao_id)
    )


def _candidato_editavel(
    sessao: Session, eleicao_id: int, candidato_id: int
) -> Candidato:
    exigir_editavel(obter_eleicao(sessao, eleicao_id))
    candidato = obter_candidato(sessao, candidato_id)
    if candidato.eleicao_id != eleicao_id:
        raise NaoEncontradoError(f"Não existe o candidato {candidato_id}.")
    return candidato


def atualizar_candidato(
    sessao: Session, eleicao_id: int, candidato_id: int, dados: CandidatoAlterar
) -> Candidato:
    candidato = _candidato_editavel(sessao, eleicao_id, candidato_id)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(candidato, campo, valor)
    return gravar(sessao, candidato)


def apagar_candidato(sessao: Session, eleicao_id: int, candidato_id: int) -> None:
    apagar(sessao, _candidato_editavel(sessao, eleicao_id, candidato_id))


def obter_candidato(sessao: Session, candidato_id: int) -> Candidato:
    candidato = repositorio.obter_por_id(sessao, candidato_id)
    if candidato is None:
        raise NaoEncontradoError(f"Não existe o candidato {candidato_id}.")
    return candidato


def listar_candidatos(
    sessao: Session, eleicao_id: int | None = None
) -> list[Candidato]:
    return repositorio.listar(sessao, eleicao_id=eleicao_id)
