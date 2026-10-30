"""Regras de negócio da votação, dos recibos e dos resultados.

O anonimato assenta em três regras: a participação (quem) e o voto (em quem)
ficam em tabelas sem ligação entre si; o servidor guarda só o hash do recibo; e
não existe nenhuma tabela que associe recibos a utilizadores.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.erros import (
    DadosInvalidosError,
    EstadoInvalidoError,
    NaoEncontradoError,
    RegistoDuplicadoError,
    SemPermissaoError,
)
from app.models.ronda import Ronda
from app.models.utilizador import Utilizador
from app.repositories import candidato as repositorio_candidato
from app.repositories import eleicao as repositorio_eleicao
from app.repositories import habilitacao as repositorio_habilitacao
from app.repositories import ronda as repositorio_ronda
from app.repositories import ronda_candidato as repositorio_ronda_candidato
from app.repositories import votacao as repositorio
from app.schemas.votacao import (
    Estatisticas,
    PontoSerie,
    ReciboVerificacao,
    ResultadoCandidato,
    ResultadoRonda,
    ResumoCandidato,
    ResumoEleicao,
    ResumoPublico,
    VotoResposta,
)
from app.services import eleicao as servico_eleicao

HORAS_DA_SERIE = 10


def _hash_recibo(recibo: str) -> str:
    return hashlib.sha256(recibo.encode()).hexdigest()


def _percentagem(parte: int, total: int) -> float:
    return round(parte / total * 100, 1) if total else 0.0


def _ronda_atual(rondas: list[Ronda]) -> Ronda | None:
    ordenadas = sorted(rondas, key=lambda ronda: ronda.numero)
    abertas = [ronda for ronda in ordenadas if ronda.estado == "aberta"]
    if abertas:
        return abertas[0]
    return ordenadas[-1] if ordenadas else None


def votar(
    sessao: Session,
    eleicao_id: int,
    numero: int,
    candidato_id: int,
    utilizador: Utilizador,
) -> VotoResposta:
    """Regista o voto e devolve o recibo, que não fica guardado no servidor."""
    eleicao = servico_eleicao.obter_eleicao_visivel(sessao, eleicao_id, utilizador)
    ronda = repositorio_ronda.obter_por_eleicao_e_numero(sessao, eleicao_id, numero)
    if ronda is None:
        raise NaoEncontradoError(f"Não existe a {numero}.ª volta desta eleição.")

    agora = datetime.now(timezone.utc)
    if (
        eleicao.estado != "em_curso"
        or ronda.estado != "aberta"
        or not ronda.data_inicio <= agora < ronda.data_fim
    ):
        raise DadosInvalidosError("Esta votação não está aberta.")

    if repositorio_habilitacao.obter(sessao, eleicao_id, utilizador.id) is None:
        raise SemPermissaoError("Não está habilitado a votar nesta eleição.")

    candidato = repositorio_candidato.obter_por_id(sessao, candidato_id)
    if (
        candidato is None
        or not candidato.ativo
        or repositorio_ronda_candidato.obter(sessao, ronda.id, candidato_id) is None
    ):
        raise DadosInvalidosError("Esse candidato não concorre nesta volta.")

    recibo = f"TV-{secrets.token_hex(12).upper()}"
    hash_voto = _hash_recibo(recibo)
    try:
        repositorio.registar_voto(
            sessao, ronda.id, utilizador.id, candidato_id, hash_voto
        )
    except repositorio.VotoRepetidoError as erro:
        raise RegistoDuplicadoError("Já votou nesta volta.") from erro
    return VotoResposta(recibo=recibo, hash=hash_voto, data=agora)


def obter_participacao(
    sessao: Session, eleicao_id: int, utilizador: Utilizador
) -> bool:
    """Diz se o utilizador já votou na volta atual da eleição."""
    servico_eleicao.obter_eleicao_visivel(sessao, eleicao_id, utilizador)
    ronda = _ronda_atual(repositorio_ronda.listar(sessao, eleicao_id=eleicao_id))
    return ronda is not None and repositorio.ja_votou(sessao, ronda.id, utilizador.id)


def verificar_recibo(sessao: Session, codigo: str) -> ReciboVerificacao:
    """Confirma que o voto do recibo foi contado, sem revelar em quem foi."""
    voto = repositorio.obter_voto_por_hash(
        sessao, _hash_recibo(codigo.strip().upper())
    )
    if voto is None:
        return ReciboVerificacao(valido=False, incluido=False, ronda=None)
    ronda = repositorio_ronda.obter_por_id(sessao, voto.ronda_id)
    return ReciboVerificacao(valido=True, incluido=True, ronda=ronda.numero)


def obter_resultados(
    sessao: Session, eleicao_id: int, utilizador: Utilizador
) -> list[ResultadoRonda]:
    """Conta os votos. Os eleitores só veem voltas encerradas, para não as influenciar."""
    servico_eleicao.obter_eleicao_visivel(sessao, eleicao_id, utilizador)
    rondas = sorted(
        repositorio_ronda.listar(sessao, eleicao_id=eleicao_id),
        key=lambda ronda: ronda.numero,
    )
    estados = ("encerrada", "apurada")
    if utilizador.perfil == "administrador":
        estados = ("aberta", *estados)
    visiveis = [ronda for ronda in rondas if ronda.estado in estados]
    if not visiveis:
        raise EstadoInvalidoError(
            "Os resultados ficam disponíveis quando a votação encerrar."
        )

    resultados = []
    for ronda in visiveis:
        votos = repositorio.contar_votos(sessao, ronda.id)
        total = sum(votos.values())
        resultados.append(
            ResultadoRonda(
                ronda=ronda.numero,
                candidatos=[
                    ResultadoCandidato(
                        id=candidato.id,
                        nome=candidato.nome,
                        total_votos=votos.get(candidato.id, 0),
                        percentagem=_percentagem(votos.get(candidato.id, 0), total),
                    )
                    for candidato in repositorio_ronda_candidato.listar_candidatos(
                        sessao, ronda.id
                    )
                ],
            )
        )
    return resultados


def obter_estatisticas(sessao: Session, eleicao_id: int) -> Estatisticas:
    """Participação total e votos por hora nas últimas horas."""
    servico_eleicao.obter_eleicao(sessao, eleicao_id)
    habilitados = repositorio_habilitacao.contar(sessao, eleicao_id)
    votantes = repositorio.contar_votantes(sessao, eleicao_id)

    agora = datetime.now(timezone.utc).replace(minute=0, second=0, microsecond=0)
    horas = [agora - timedelta(hours=n) for n in range(HORAS_DA_SERIE - 1, -1, -1)]
    contagem = dict.fromkeys(horas, 0)
    for momento in repositorio.datas_de_participacao(sessao, eleicao_id, horas[0]):
        hora = momento.astimezone(timezone.utc).replace(
            minute=0, second=0, microsecond=0
        )
        if hora in contagem:
            contagem[hora] += 1

    return Estatisticas(
        habilitados=habilitados,
        votantes=votantes,
        participacao=_percentagem(votantes, habilitados),
        serie=[PontoSerie(hora=hora, votos=total) for hora, total in contagem.items()],
    )


def obter_resumo_publico(sessao: Session) -> ResumoPublico:
    """Resumo da eleição em destaque: a que decorre, a próxima ou a última."""
    eleicoes = repositorio_eleicao.listar(sessao)
    for estado in ("em_curso", "agendada", "encerrada"):
        escolhidas = [eleicao for eleicao in eleicoes if eleicao.estado == estado]
        if escolhidas:
            eleicao = escolhidas[-1]
            break
    else:
        raise NaoEncontradoError("Ainda não há eleições públicas.")

    ronda = _ronda_atual(repositorio_ronda.listar(sessao, eleicao_id=eleicao.id))
    eleitores = repositorio_habilitacao.contar(sessao, eleicao.id)
    votos = repositorio.contar_votantes(sessao, eleicao.id)
    candidatos = repositorio_candidato.listar(sessao, eleicao_id=eleicao.id)
    return ResumoPublico(
        eleicao=ResumoEleicao(
            id=eleicao.id,
            titulo=eleicao.titulo,
            estado=eleicao.estado,
            data_inicio=ronda.data_inicio if ronda else None,
            data_fim=ronda.data_fim if ronda else None,
        ),
        eleitores=eleitores,
        votos=votos,
        participacao=_percentagem(votos, eleitores),
        candidatos=[
            ResumoCandidato(
                id=candidato.id,
                nome=candidato.nome,
                partido=candidato.partido,
                descricao=candidato.descricao,
            )
            for candidato in candidatos
            if candidato.ativo
        ],
    )
