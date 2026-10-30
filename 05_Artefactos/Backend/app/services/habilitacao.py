"""Regras de negócio das habilitações (quem pode votar em cada eleição)."""

from sqlalchemy.orm import Session

from app.database import apagar
from app.erros import EstadoInvalidoError, NaoEncontradoError, RegistoDuplicadoError
from app.models.habilitacao import Habilitacao
from app.repositories import eleicao as repositorio_eleicao
from app.repositories import habilitacao as repositorio
from app.repositories import utilizador as repositorio_utilizador
from app.schemas.habilitacao import (
    HabilitacaoCriar,
    HabilitacaoLoteResposta,
    HabilitadoResposta,
)


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


def _eleicao_nao_encerrada(sessao: Session, eleicao_id: int) -> None:
    eleicao = repositorio_eleicao.obter_por_id(sessao, eleicao_id)
    if eleicao is None:
        raise NaoEncontradoError(f"Não existe a eleição {eleicao_id}.")
    if eleicao.estado == "encerrada":
        raise EstadoInvalidoError("O caderno de uma eleição encerrada não muda.")


def habilitar_lote(
    sessao: Session, eleicao_id: int, utilizador_ids: list[int]
) -> HabilitacaoLoteResposta:
    """Habilita vários utilizadores; quem já estava habilitado é apenas contado."""
    _eleicao_nao_encerrada(sessao, eleicao_id)
    adicionados = 0
    ja_habilitados = 0
    for utilizador_id in set(utilizador_ids):
        if repositorio_utilizador.obter_por_id(sessao, utilizador_id) is None:
            raise NaoEncontradoError(f"Não existe o utilizador {utilizador_id}.")
        if repositorio.obter(sessao, eleicao_id, utilizador_id) is not None:
            ja_habilitados += 1
            continue
        repositorio.criar(sessao, eleicao_id=eleicao_id, utilizador_id=utilizador_id)
        adicionados += 1
    return HabilitacaoLoteResposta(
        adicionados=adicionados, ja_habilitados=ja_habilitados
    )


def desabilitar(sessao: Session, eleicao_id: int, utilizador_id: int) -> None:
    _eleicao_nao_encerrada(sessao, eleicao_id)
    habilitacao = repositorio.obter(sessao, eleicao_id, utilizador_id)
    if habilitacao is None:
        raise NaoEncontradoError("Esse utilizador não está habilitado nesta eleição.")
    apagar(sessao, habilitacao)


def listar_habilitados(sessao: Session, eleicao_id: int) -> list[HabilitadoResposta]:
    if repositorio_eleicao.obter_por_id(sessao, eleicao_id) is None:
        raise NaoEncontradoError(f"Não existe a eleição {eleicao_id}.")
    return [
        HabilitadoResposta(
            utilizador_id=utilizador.id,
            nome=utilizador.nome_utilizador,
            email=utilizador.email,
            data=habilitacao.registada_em,
        )
        for habilitacao, utilizador in repositorio.listar_com_utilizador(
            sessao, eleicao_id
        )
    ]


def listar_habilitacoes(
    sessao: Session, eleicao_id: int | None = None
) -> list[Habilitacao]:
    return repositorio.listar(sessao, eleicao_id=eleicao_id)
