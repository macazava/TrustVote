"""Endpoints de gestão dos candidatos de cada ronda (só administradores).

A tabela não tem id próprio (chave é o par ronda + candidato), por isso só há
criação e listagem.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.schemas.ronda_candidato import RondaCandidatoCriar, RondaCandidatoResposta
from app.security.dependencias import exigir_administrador
from app.services import ronda_candidato as servico

ronda_candidato_routers = APIRouter(
    prefix="/rondas-candidatos",
    tags=["rondas-candidatos"],
    dependencies=[Depends(exigir_administrador)],
)


@ronda_candidato_routers.post(
    "", response_model=RondaCandidatoResposta, status_code=status.HTTP_201_CREATED
)
def criar_ronda_candidato(
    dados: RondaCandidatoCriar, sessao: Session = Depends(obter_sessao)
):
    """Põe um candidato a concorrer numa ronda."""
    return servico.criar_ronda_candidato(sessao, dados)


@ronda_candidato_routers.get("", response_model=list[RondaCandidatoResposta])
def listar_ronda_candidatos(
    ronda_id: int | None = None, sessao: Session = Depends(obter_sessao)
):
    """Lista as inscrições; com `ronda_id` filtra por ronda."""
    return servico.listar_ronda_candidatos(sessao, ronda_id=ronda_id)
