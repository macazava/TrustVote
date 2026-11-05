"""Regras de negócio da votação, dos recibos e dos resultados.

O anonimato assenta em três regras: a participação (quem) e o voto (em quem)
ficam em tabelas sem ligação entre si; o servidor guarda só o hash do recibo; e
não existe nenhuma tabela que associe recibos a utilizadores.
"""

import hashlib
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app import cache
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
    ConfiguracaoPublica,
    Estatisticas,
    HistoricoEleicao,
    IntegridadeEleicao,
    IntegridadeRonda,
    PontoSerie,
    ReciboVerificacao,
    ResultadoCandidato,
    ResultadoRonda,
    ResumoCandidato,
    ResumoEleicao,
    ResumoPublico,
    VotoResposta,
)
from app.security import tokens
from app.security.integridade import selo, selo_valido
from app.services import apuramento
from app.services import eleicao as servico_eleicao
from app.services.apuramento import percentagem as _percentagem

HORAS_DA_SERIE = 10


def _hash_recibo(recibo: str) -> str:
    return hashlib.sha256(recibo.encode()).hexdigest()


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
    candidato_id: int | None,
    utilizador: Utilizador,
) -> VotoResposta:
    """Regista o voto e devolve o recibo, que não fica guardado no servidor.

    `candidato_id` a None é um voto em branco.
    """
    eleicao = servico_eleicao.obter_eleicao_visivel(sessao, eleicao_id, utilizador)
    # Segura a ronda até ao commit: quem a encerrar espera por este voto.
    ronda = repositorio_ronda.obter_por_eleicao_e_numero(
        sessao, eleicao_id, numero, bloqueio="partilhado"
    )
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

    if candidato_id is not None:
        candidato = repositorio_candidato.obter_por_id(sessao, candidato_id)
        if (
            candidato is None
            or not candidato.ativo
            or repositorio_ronda_candidato.obter(sessao, ronda.id, candidato_id) is None
        ):
            raise DadosInvalidosError("Esse candidato não concorre nesta volta.")

    recibo = f"TV-{secrets.token_hex(12).upper()}"
    hash_voto = _hash_recibo(recibo)
    voto_id = uuid.uuid4()
    try:
        repositorio.registar_voto(
            sessao,
            voto_id=voto_id,
            ronda_id=ronda.id,
            utilizador_id=utilizador.id,
            candidato_id=candidato_id,
            hash_voto=hash_voto,
            integridade=selo(voto_id, ronda.id, candidato_id, hash_voto),
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
    # Um voto com o selo errado foi alterado fora da API e não entra na contagem.
    return ReciboVerificacao(valido=True, incluido=selo_valido(voto), ronda=ronda.numero)


def _resultado_ronda(
    sessao: Session, ronda: Ronda, habilitados: int, quorum: float
) -> ResultadoRonda:
    contagem = apuramento.contagem_da_ronda(sessao, ronda)
    votantes = repositorio.contar_participacoes(sessao, ronda.id)
    participacao = _percentagem(votantes, habilitados)
    return ResultadoRonda(
        ronda=ronda.numero,
        estado=ronda.estado,
        apurada=ronda.estado == "apurada",
        candidatos=[
            ResultadoCandidato(
                id=candidato.id,
                nome=candidato.nome,
                total_votos=contagem.por_candidato.get(candidato.id, 0),
                percentagem=_percentagem(
                    contagem.por_candidato.get(candidato.id, 0), contagem.em_candidatos
                ),
            )
            for candidato in repositorio_ronda_candidato.listar_candidatos(
                sessao, ronda.id
            )
        ],
        brancos=contagem.brancos,
        percentagem_brancos=_percentagem(contagem.brancos, contagem.validos),
        invalidos=contagem.invalidos,
        votantes=votantes,
        habilitados=habilitados,
        participacao=participacao,
        quorum=quorum,
        # Comparado sem arredondar, para 49,96% não passar por 50%.
        quorum_atingido=habilitados > 0 and votantes * 100 >= quorum * habilitados,
    )


def obter_resultados(
    sessao: Session, eleicao_id: int, utilizador: Utilizador
) -> list[ResultadoRonda]:
    """Votos em cada volta. Os eleitores só veem voltas encerradas, para não as influenciar."""
    eleicao = servico_eleicao.obter_eleicao_visivel(sessao, eleicao_id, utilizador)
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

    habilitados = repositorio_habilitacao.contar(sessao, eleicao_id)
    return [
        _resultado_ronda(sessao, ronda, habilitados, float(eleicao.quorum))
        for ronda in visiveis
    ]


def verificar_integridade(sessao: Session, eleicao_id: int) -> IntegridadeEleicao:
    """Confere os selos e se há tantos votos na urna como eleitores que votaram."""
    servico_eleicao.obter_eleicao(sessao, eleicao_id)
    rondas = []
    for ronda in sorted(
        repositorio_ronda.listar(sessao, eleicao_id=eleicao_id), key=lambda r: r.numero
    ):
        contagem = apuramento.contar(sessao, ronda)
        votos = contagem.validos + contagem.invalidos
        participacoes = repositorio.contar_participacoes(sessao, ronda.id)
        rondas.append(
            IntegridadeRonda(
                ronda=ronda.numero,
                votos=votos,
                participacoes=participacoes,
                selos_invalidos=contagem.invalidos,
                coincide=votos == participacoes,
            )
        )
    return IntegridadeEleicao(
        valida=all(r.coincide and not r.selos_invalidos for r in rondas), rondas=rondas
    )


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


def obter_historico_publico(sessao: Session) -> list[HistoricoEleicao]:
    """Eleições encerradas, da mais recente para a mais antiga."""
    historico = []
    for eleicao in reversed(repositorio_eleicao.listar(sessao, estado="encerrada")):
        rondas = repositorio_ronda.listar(sessao, eleicao_id=eleicao.id)
        eleitores = repositorio_habilitacao.contar(sessao, eleicao.id)
        votos = repositorio.contar_votantes(sessao, eleicao.id)
        historico.append(
            HistoricoEleicao(
                id=eleicao.id,
                titulo=eleicao.titulo,
                descricao=eleicao.descricao,
                data_inicio=min((r.data_inicio for r in rondas), default=None),
                data_fim=max((r.data_fim for r in rondas), default=None),
                eleitores=eleitores,
                votos=votos,
                participacao=_percentagem(votos, eleitores),
                apurada_em=repositorio.ultimo_apuramento(sessao, [r.id for r in rondas]),
            )
        )
    return historico


def obter_configuracao_publica() -> ConfiguracaoPublica:
    """Valores lidos do ambiente da API: as páginas mostram as regras reais."""
    return ConfiguracaoPublica(
        sessao_minutos=tokens.MINUTOS_VALIDADE,
        login_tentativas=cache.TENTATIVAS_LOGIN,
        login_bloqueio_minutos=cache.JANELA_LOGIN // 60,
        apuramento="worker" if apuramento.NO_WORKER else "imediato",
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
