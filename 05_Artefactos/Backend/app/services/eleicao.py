"""Regras de negócio das eleições."""

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.database import apagar, gravar
from app.erros import EstadoInvalidoError, NaoEncontradoError
from app.models.eleicao import Eleicao
from app.models.ronda import Ronda
from app.models.utilizador import Utilizador
from app.repositories import candidato as repositorio_candidato
from app.repositories import eleicao as repositorio
from app.repositories import habilitacao as repositorio_habilitacao
from app.repositories import ronda as repositorio_ronda
from app.repositories import ronda_candidato as repositorio_ronda_candidato
from app.schemas.candidato import CandidatoResposta
from app.schemas.eleicao import (
    EleicaoAlterar,
    EleicaoCriar,
    EleicaoDetalhe,
    EleicaoResposta,
)
from app.schemas.ronda import RondaDetalhe, RondaResposta

ESTADOS_EDITAVEIS = ("rascunho", "agendada")


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


def exigir_editavel(eleicao: Eleicao) -> None:
    """Depois de a votação começar, a eleição deixa de poder ser alterada."""
    if eleicao.estado not in ESTADOS_EDITAVEIS:
        raise EstadoInvalidoError(
            "Só é possível alterar a eleição antes de a votação começar."
        )


def obter_eleicao_visivel(
    sessao: Session, eleicao_id: int, utilizador: Utilizador
) -> Eleicao:
    """Devolve a eleição se o utilizador a puder ver; senão, como se não existisse."""
    eleicao = obter_eleicao(sessao, eleicao_id)
    if utilizador.perfil == "administrador":
        return eleicao
    if (
        eleicao.estado == "rascunho"
        or repositorio_habilitacao.obter(sessao, eleicao_id, utilizador.id) is None
    ):
        raise NaoEncontradoError(f"Não existe a eleição {eleicao_id}.")
    return eleicao


def listar_eleicoes(
    sessao: Session, utilizador: Utilizador, estado: str | None = None
) -> list[Eleicao]:
    if utilizador.perfil == "administrador":
        return repositorio.listar(sessao, estado=estado)
    return repositorio.listar_para_eleitor(sessao, utilizador.id, estado=estado)


def detalhe_eleicao(sessao: Session, eleicao: Eleicao) -> EleicaoDetalhe:
    """Junta à eleição os candidatos e as rondas, cada uma com os seus candidatos."""
    rondas = repositorio_ronda.listar(sessao, eleicao_id=eleicao.id)
    base = EleicaoResposta.model_validate(eleicao).model_dump(exclude={"data_criacao"})
    return EleicaoDetalhe(
        **base,
        candidatos=[
            CandidatoResposta.model_validate(candidato)
            for candidato in repositorio_candidato.listar(
                sessao, eleicao_id=eleicao.id
            )
        ],
        rondas=[
            RondaDetalhe(
                **RondaResposta.model_validate(ronda).model_dump(),
                candidatos=[
                    CandidatoResposta.model_validate(candidato)
                    for candidato in repositorio_ronda_candidato.listar_candidatos(
                        sessao, ronda.id
                    )
                ],
            )
            for ronda in rondas
        ],
    )


def atualizar_eleicao(
    sessao: Session, eleicao_id: int, dados: EleicaoAlterar
) -> Eleicao:
    eleicao = obter_eleicao(sessao, eleicao_id)
    exigir_editavel(eleicao)
    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(eleicao, campo, valor)
    return gravar(sessao, eleicao)


def apagar_eleicao(sessao: Session, eleicao_id: int) -> None:
    eleicao = obter_eleicao(sessao, eleicao_id)
    if eleicao.estado != "rascunho":
        raise EstadoInvalidoError("Só é possível apagar eleições em rascunho.")
    apagar(sessao, eleicao)


def _primeira_ronda(sessao: Session, eleicao_id: int) -> Ronda | None:
    return repositorio_ronda.obter_por_eleicao_e_numero(sessao, eleicao_id, 1)


def _candidatos_ativos(sessao: Session, eleicao_id: int) -> list[int]:
    return [
        candidato.id
        for candidato in repositorio_candidato.listar(sessao, eleicao_id=eleicao_id)
        if candidato.ativo
    ]


def _validar_preparacao(sessao: Session, eleicao: Eleicao) -> Ronda:
    """Confirma que a eleição tem tudo o que precisa para a votação acontecer."""
    ronda = _primeira_ronda(sessao, eleicao.id)
    if (
        ronda is None
        or ronda.data_fim <= datetime.now(timezone.utc)
        or len(_candidatos_ativos(sessao, eleicao.id)) < 2
        or repositorio_habilitacao.contar(sessao, eleicao.id) < 1
    ):
        raise EstadoInvalidoError(
            "Para avançar: 1.ª volta com fim no futuro, pelo menos 2 candidatos "
            "ativos e 1 eleitor habilitado."
        )
    return ronda


def agendar_eleicao(sessao: Session, eleicao_id: int) -> Eleicao:
    eleicao = obter_eleicao(sessao, eleicao_id)
    if eleicao.estado != "rascunho":
        raise EstadoInvalidoError("Só é possível agendar eleições em rascunho.")
    ronda = _validar_preparacao(sessao, eleicao)
    repositorio_ronda_candidato.substituir(
        sessao, ronda.id, _candidatos_ativos(sessao, eleicao.id)
    )
    eleicao.estado = "agendada"
    return gravar(sessao, eleicao)


def iniciar_eleicao(sessao: Session, eleicao_id: int) -> Eleicao:
    eleicao = obter_eleicao(sessao, eleicao_id)
    if eleicao.estado != "agendada":
        raise EstadoInvalidoError("Só é possível iniciar eleições agendadas.")
    ronda = _validar_preparacao(sessao, eleicao)
    # A lista pode ter mudado depois de agendar; aqui ainda não há votos.
    repositorio_ronda_candidato.substituir(
        sessao, ronda.id, _candidatos_ativos(sessao, eleicao.id)
    )
    ronda.estado = "aberta"
    eleicao.estado = "em_curso"
    return gravar(sessao, eleicao)


def encerrar_eleicao(sessao: Session, eleicao_id: int) -> Eleicao:
    eleicao = obter_eleicao(sessao, eleicao_id)
    if eleicao.estado != "em_curso":
        raise EstadoInvalidoError("Só é possível encerrar eleições em curso.")
    for ronda in repositorio_ronda.listar(sessao, eleicao_id=eleicao.id):
        if ronda.estado == "aberta":
            ronda.estado = "encerrada"
    eleicao.estado = "encerrada"
    return gravar(sessao, eleicao)
