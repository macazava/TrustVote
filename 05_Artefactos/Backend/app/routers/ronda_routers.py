"""Endpoints de gestão de rondas (só administradores)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.schemas.ronda import RondaCriar, RondaResposta
from app.security.dependencias import exigir_administrador
from app.services import ronda as servico

ronda_routers = APIRouter(
    prefix="/rondas",
    tags=["rondas"],
    dependencies=[Depends(exigir_administrador)],
)


@ronda_routers.post(
    "", response_model=RondaResposta, status_code=status.HTTP_201_CREATED
)
def criar_ronda(dados: RondaCriar, sessao: Session = Depends(obter_sessao)):
    """Cria uma ronda (1.ª ou 2.ª volta) numa eleição existente."""
    return servico.criar_ronda(sessao, dados)


@ronda_routers.get("", response_model=list[RondaResposta])
def listar_rondas(
    eleicao_id: int | None = None, sessao: Session = Depends(obter_sessao)
):
    """Lista as rondas; com `eleicao_id` filtra por eleição."""
    return servico.listar_rondas(sessao, eleicao_id=eleicao_id)


@ronda_routers.get("/{ronda_id}", response_model=RondaResposta)
def obter_ronda(ronda_id: int, sessao: Session = Depends(obter_sessao)):
    """Devolve uma ronda pelo seu id."""
    return servico.obter_ronda(sessao, ronda_id)
