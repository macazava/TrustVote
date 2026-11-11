"""Endpoints da sondagem (intenção de voto, sem valor eleitoral)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.models.utilizador import Utilizador
from app.schemas.sondagem import SondagemPedido, SondagemResposta
from app.security.dependencias import utilizador_atual
from app.services import sondagem as servico

sondagem_routers = APIRouter(prefix="/eleicoes/{eleicao_id}/sondagem", tags=["sondagem"])


@sondagem_routers.get("", response_model=SondagemResposta)
def obter_sondagem(
    eleicao_id: int,
    sessao: Session = Depends(obter_sessao),
    utilizador: Utilizador = Depends(utilizador_atual),
):
    """Projeção atual e se o utilizador já respondeu."""
    return servico.obter_sondagem(sessao, eleicao_id, utilizador)


@sondagem_routers.post("/respostas", status_code=status.HTTP_204_NO_CONTENT)
def responder_sondagem(
    eleicao_id: int,
    dados: SondagemPedido,
    sessao: Session = Depends(obter_sessao),
    utilizador: Utilizador = Depends(utilizador_atual),
):
    """Regista a intenção de voto (uma por eleitor e por eleição)."""
    servico.responder(sessao, eleicao_id, dados.candidato_id, utilizador)
