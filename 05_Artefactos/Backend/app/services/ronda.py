"""Regras de negócio das rondas."""

from sqlalchemy.orm import Session

from app.database import gravar
from app.erros import (
    DadosInvalidosError,
    EstadoInvalidoError,
    NaoEncontradoError,
    RegistoDuplicadoError,
)
from app.models.ronda import Ronda
from app.repositories import candidato as repositorio_candidato
from app.repositories import eleicao as repositorio_eleicao
from app.repositories import ronda as repositorio
from app.repositories import ronda_candidato as repositorio_ronda_candidato
from app.schemas.ronda import RondaCriar, RondaDatas, RondaNova


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


def criar_ronda_na_eleicao(
    sessao: Session, eleicao_id: int, dados: RondaNova
) -> Ronda:
    """Cria a volta seguinte: a 1.ª na preparação, a 2.ª depois de a 1.ª encerrar."""
    eleicao = repositorio_eleicao.obter_por_id(sessao, eleicao_id)
    if eleicao is None:
        raise NaoEncontradoError(f"Não existe a eleição {eleicao_id}.")

    rondas = repositorio.listar(sessao, eleicao_id=eleicao_id)
    if len(rondas) >= 2:
        raise RegistoDuplicadoError("Esta eleição já tem as duas voltas.")

    candidato_ids = dados.candidato_ids or []
    if rondas:
        if eleicao.estado != "em_curso" or rondas[0].estado == "agendada":
            raise EstadoInvalidoError("A 2.ª volta só existe depois da 1.ª.")
        if rondas[0].estado == "aberta":
            raise EstadoInvalidoError("Encerre a 1.ª volta antes de criar a 2.ª.")
        if len(set(candidato_ids)) != 2:
            raise DadosInvalidosError("A 2.ª volta tem exatamente 2 candidatos.")
    elif eleicao.estado not in ("rascunho", "agendada"):
        raise EstadoInvalidoError("A eleição já não pode receber a 1.ª volta.")

    for candidato_id in candidato_ids:
        candidato = repositorio_candidato.obter_por_id(sessao, candidato_id)
        if candidato is None or candidato.eleicao_id != eleicao_id:
            raise DadosInvalidosError("O candidato não pertence a esta eleição.")

    ronda = criar_ronda(
        sessao,
        RondaCriar(
            eleicao_id=eleicao_id,
            numero=len(rondas) + 1,
            data_inicio=dados.data_inicio,
            data_fim=dados.data_fim,
        ),
    )
    repositorio_ronda_candidato.substituir(sessao, ronda.id, candidato_ids)
    return ronda


def _obter_por_numero(sessao: Session, eleicao_id: int, numero: int) -> Ronda:
    ronda = repositorio.obter_por_eleicao_e_numero(sessao, eleicao_id, numero)
    if ronda is None:
        raise NaoEncontradoError(f"Não existe a {numero}.ª volta desta eleição.")
    return ronda


def atualizar_ronda(
    sessao: Session, eleicao_id: int, numero: int, dados: RondaDatas
) -> Ronda:
    ronda = _obter_por_numero(sessao, eleicao_id, numero)
    if ronda.estado != "agendada":
        raise EstadoInvalidoError("Só é possível alterar voltas que ainda não abriram.")
    if dados.data_fim <= dados.data_inicio:
        raise DadosInvalidosError("A data de fim tem de ser posterior à de início.")
    ronda.data_inicio = dados.data_inicio
    ronda.data_fim = dados.data_fim
    return gravar(sessao, ronda)


def abrir_ronda(sessao: Session, eleicao_id: int, numero: int) -> Ronda:
    ronda = _obter_por_numero(sessao, eleicao_id, numero)
    eleicao = repositorio_eleicao.obter_por_id(sessao, eleicao_id)
    if eleicao.estado != "em_curso":
        raise EstadoInvalidoError("A eleição não está em curso.")
    if ronda.estado != "agendada":
        raise EstadoInvalidoError("Esta volta já foi aberta.")
    if any(
        outra.estado == "aberta"
        for outra in repositorio.listar(sessao, eleicao_id=eleicao_id)
    ):
        raise EstadoInvalidoError("Já existe outra volta aberta.")
    ronda.estado = "aberta"
    return gravar(sessao, ronda)


def encerrar_ronda(sessao: Session, eleicao_id: int, numero: int) -> Ronda:
    ronda = _obter_por_numero(sessao, eleicao_id, numero)
    if ronda.estado != "aberta":
        raise EstadoInvalidoError("Esta volta não está aberta.")
    ronda.estado = "encerrada"
    return gravar(sessao, ronda)


def obter_ronda(sessao: Session, ronda_id: int) -> Ronda:
    ronda = repositorio.obter_por_id(sessao, ronda_id)
    if ronda is None:
        raise NaoEncontradoError(f"Não existe a ronda {ronda_id}.")
    return ronda


def listar_rondas(sessao: Session, eleicao_id: int | None = None) -> list[Ronda]:
    return repositorio.listar(sessao, eleicao_id=eleicao_id)
