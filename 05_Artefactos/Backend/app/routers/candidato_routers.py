"""Endpoints de gestão de candidatos (só administradores)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.schemas.candidato import CandidatoCriar, CandidatoResposta
from app.security.dependencias import exigir_administrador
from app.services import candidato as servico

candidato_routers = APIRouter(
    prefix="/candidatos",
    tags=["candidatos"],
    dependencies=[Depends(exigir_administrador)],
)


@candidato_routers.post(
    "", response_model=CandidatoResposta, status_code=status.HTTP_201_CREATED
)
def criar_candidato(dados: CandidatoCriar, sessao: Session = Depends(obter_sessao)):
    """Cria um candidato numa eleição existente."""
    return servico.criar_candidato(sessao, dados)


@candidato_routers.get("", response_model=list[CandidatoResposta])
def listar_candidatos(
    eleicao_id: int | None = None, sessao: Session = Depends(obter_sessao)
):
    """Lista os candidatos; com `eleicao_id` filtra por eleição."""
    return servico.listar_candidatos(sessao, eleicao_id=eleicao_id)


@candidato_routers.get("/{candidato_id}", response_model=CandidatoResposta)
def obter_candidato(candidato_id: int, sessao: Session = Depends(obter_sessao)):
    """Devolve um candidato pelo seu id."""
    return servico.obter_candidato(sessao, candidato_id)
