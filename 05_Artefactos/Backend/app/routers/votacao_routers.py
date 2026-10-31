"""Endpoints de votação, recibos, resultados e resumo público."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.models.utilizador import Utilizador
from app.schemas.votacao import (
    Estatisticas,
    ParticipacaoResposta,
    ReciboVerificacao,
    ResultadoRonda,
    ResumoPublico,
    VotoPedido,
    VotoResposta,
)
from app.security.dependencias import exigir_administrador, utilizador_atual
from app.services import votacao as servico

votacao_routers = APIRouter(tags=["votacao"])


@votacao_routers.post(
    "/eleicoes/{eleicao_id}/rondas/{numero}/votos",
    response_model=VotoResposta,
    status_code=status.HTTP_201_CREATED,
)
def votar(
    eleicao_id: int,
    numero: int,
    dados: VotoPedido,
    sessao: Session = Depends(obter_sessao),
    utilizador: Utilizador = Depends(utilizador_atual),
):
    """Deposita o voto do utilizador autenticado e devolve o recibo."""
    return servico.votar(sessao, eleicao_id, numero, dados.candidato_id, utilizador)


@votacao_routers.get(
    "/eleicoes/{eleicao_id}/participacao", response_model=ParticipacaoResposta
)
def obter_participacao(
    eleicao_id: int,
    sessao: Session = Depends(obter_sessao),
    utilizador: Utilizador = Depends(utilizador_atual),
):
    """Diz se o utilizador autenticado já votou na volta atual."""
    return ParticipacaoResposta(
        votou=servico.obter_participacao(sessao, eleicao_id, utilizador)
    )


@votacao_routers.get(
    "/eleicoes/{eleicao_id}/resultados", response_model=list[ResultadoRonda]
)
def obter_resultados(
    eleicao_id: int,
    sessao: Session = Depends(obter_sessao),
    utilizador: Utilizador = Depends(utilizador_atual),
):
    """Votos por candidato em cada volta."""
    return servico.obter_resultados(sessao, eleicao_id, utilizador)


@votacao_routers.get(
    "/eleicoes/{eleicao_id}/estatisticas",
    response_model=Estatisticas,
    dependencies=[Depends(exigir_administrador)],
)
def obter_estatisticas(eleicao_id: int, sessao: Session = Depends(obter_sessao)):
    """Participação e votos por hora (só administradores)."""
    return servico.obter_estatisticas(sessao, eleicao_id)


@votacao_routers.get(
    "/recibos/{codigo}/verificar",
    response_model=ReciboVerificacao,
    dependencies=[Depends(utilizador_atual)],
)
def verificar_recibo(codigo: str, sessao: Session = Depends(obter_sessao)):
    """Confirma que o voto de um recibo foi contado, sem revelar em quem foi."""
    return servico.verificar_recibo(sessao, codigo)


@votacao_routers.get("/publico/resumo", response_model=ResumoPublico)
def obter_resumo_publico(sessao: Session = Depends(obter_sessao)):
    """Dados da eleição em destaque para as páginas sem sessão."""
    return servico.obter_resumo_publico(sessao)
