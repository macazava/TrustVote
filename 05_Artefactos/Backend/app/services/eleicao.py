"""Regras de negócio das eleições."""

from sqlalchemy.orm import Session

from app.erros import NaoEncontradoError
from app.models.eleicao import Eleicao
from app.repositories import eleicao as repositorio
from app.schemas.eleicao import EleicaoCriar


def criar_eleicao(sessao: Session, dados: EleicaoCriar, criador_id: int) -> Eleicao:
    """Cria uma eleição em estado 'rascunho'."""
    return repositorio.criar(
        sessao,
        titulo=dados.titulo,
        descricao=dados.descricao,
        criador_id=criador_id,
    )


def obter_eleicao(sessao: Session, eleicao_id: int) -> Eleicao:
    eleicao = repositorio.obter_por_id(sessao, eleicao_id)
    if eleicao is None:
        raise NaoEncontradoError(f"Não existe a eleição {eleicao_id}.")
    return eleicao


def listar_eleicoes(sessao: Session) -> list[Eleicao]:
    return repositorio.listar(sessao)
