"""Endpoints de gestão de eleições (só administradores)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.models.utilizador import Utilizador
from app.schemas.eleicao import EleicaoCriar, EleicaoResposta
from app.security.dependencias import exigir_administrador
from app.services import eleicao as servico

eleicao_routers = APIRouter(
    prefix="/eleicoes",
    tags=["eleicoes"],
    dependencies=[Depends(exigir_administrador)],
)


@eleicao_routers.post(
    "", response_model=EleicaoResposta, status_code=status.HTTP_201_CREATED
)
def criar_eleicao(
    dados: EleicaoCriar,
    sessao: Session = Depends(obter_sessao),
    administrador: Utilizador = Depends(exigir_administrador),
):
    """Cria uma eleição em estado 'rascunho', com o criador tirado do token."""
    return servico.criar_eleicao(sessao, dados, criador_id=administrador.id)


@eleicao_routers.get("", response_model=list[EleicaoResposta])
def listar_eleicoes(sessao: Session = Depends(obter_sessao)):
    """Lista as eleições existentes."""
    return servico.listar_eleicoes(sessao)


@eleicao_routers.get("/{eleicao_id}", response_model=EleicaoResposta)
def obter_eleicao(eleicao_id: int, sessao: Session = Depends(obter_sessao)):
    """Devolve uma eleição pelo seu id."""
    return servico.obter_eleicao(sessao, eleicao_id)
