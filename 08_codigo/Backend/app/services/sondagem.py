"""Sondagem: intenção de voto declarada pelos eleitores, sem valor eleitoral.

A projeção usa um modelo bayesiano simples: parte de uma distribuição uniforme
(como se cada candidato tivesse já uma resposta) e atualiza-a com as respostas
recebidas (média de uma Dirichlet). Com poucas respostas a projeção fica perto
da igualdade; com muitas aproxima-se das proporções observadas. A margem é a
de uma proporção a 95%, para o candidato com mais incerteza.

Como no voto, o servidor sabe quem respondeu, mas não o que cada um respondeu.
"""

import math

from sqlalchemy.orm import Session

from app.erros import DadosInvalidosError, EstadoInvalidoError, RegistoDuplicadoError
from app.models.candidato import Candidato
from app.models.eleicao import Eleicao
from app.models.utilizador import Utilizador
from app.repositories import candidato as repositorio_candidato
from app.repositories import ronda as repositorio_ronda
from app.repositories import ronda_candidato as repositorio_ronda_candidato
from app.repositories import sondagem as repositorio
from app.schemas.sondagem import ProjecaoCandidato, SondagemResposta
from app.services import eleicao as servico_eleicao

MODELO = "Bayesiano"
ESTADOS_ABERTOS = ("agendada", "em_curso")


def _candidatos(sessao: Session, eleicao: Eleicao) -> list[Candidato]:
    """Os da volta atual (a última criada) ou, sem lista definida, os ativos da eleição."""
    rondas = sorted(repositorio_ronda.listar(sessao, eleicao_id=eleicao.id), key=lambda r: r.numero)
    if rondas:
        da_ronda = repositorio_ronda_candidato.listar_candidatos(sessao, rondas[-1].id)
        if da_ronda:
            return da_ronda
    return [
        candidato
        for candidato in repositorio_candidato.listar(sessao, eleicao_id=eleicao.id)
        if candidato.ativo
    ]


def obter_sondagem(sessao: Session, eleicao_id: int, utilizador: Utilizador) -> SondagemResposta:
    eleicao = servico_eleicao.obter_eleicao_visivel(sessao, eleicao_id, utilizador)
    candidatos = _candidatos(sessao, eleicao)
    respostas = repositorio.contar_respostas(sessao, eleicao.id)
    contagens = [respostas.get(candidato.id, 0) for candidato in candidatos]
    amostra = sum(contagens)
    k = len(candidatos)
    projecoes = [(n + 1) / (amostra + k) for n in contagens] if k else []
    intervalo = (
        max(1.96 * math.sqrt(p * (1 - p) / (amostra + k)) for p in projecoes) * 100
        if projecoes
        else 0.0
    )
    return SondagemResposta(
        modelo=MODELO,
        amostra=amostra,
        intervalo=round(intervalo, 1),
        projecao=sorted(
            (
                ProjecaoCandidato(
                    candidato_id=candidato.id,
                    nome=candidato.nome,
                    percentagem=round(p * 100, 1),
                )
                for candidato, p in zip(candidatos, projecoes)
            ),
            key=lambda projecao: projecao.percentagem,
            reverse=True,
        ),
        respondeu=repositorio.ja_respondeu(sessao, eleicao.id, utilizador.id),
    )


def responder(
    sessao: Session, eleicao_id: int, candidato_id: int, utilizador: Utilizador
) -> None:
    eleicao = servico_eleicao.obter_eleicao_visivel(sessao, eleicao_id, utilizador)
    if eleicao.estado not in ESTADOS_ABERTOS:
        raise EstadoInvalidoError("A sondagem desta eleição já fechou.")
    if candidato_id not in {candidato.id for candidato in _candidatos(sessao, eleicao)}:
        raise DadosInvalidosError("Esse candidato não concorre nesta eleição.")
    try:
        repositorio.responder(sessao, eleicao.id, utilizador.id, candidato_id)
    except repositorio.RespostaRepetidaError as erro:
        raise RegistoDuplicadoError("Já respondeu a esta sondagem.") from erro
