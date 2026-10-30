"""Endpoints de gestão de habilitações (só administradores).

A tabela não tem id próprio (chave é o par eleição + utilizador), por isso só há
criação e listagem.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.schemas.habilitacao import HabilitacaoCriar, HabilitacaoResposta
from app.security.dependencias import exigir_administrador
from app.services import habilitacao as servico

habilitacao_routers = APIRouter(
    prefix="/habilitacoes",
    tags=["habilitacoes"],
    dependencies=[Depends(exigir_administrador)],
)


@habilitacao_routers.post(
    "", response_model=HabilitacaoResposta, status_code=status.HTTP_201_CREATED
)
def criar_habilitacao(
    dados: HabilitacaoCriar, sessao: Session = Depends(obter_sessao)
):
    """Habilita um utilizador a votar numa eleição."""
    return servico.criar_habilitacao(sessao, dados)


@habilitacao_routers.get("", response_model=list[HabilitacaoResposta])
def listar_habilitacoes(
    eleicao_id: int | None = None, sessao: Session = Depends(obter_sessao)
):
    """Lista as habilitações; com `eleicao_id` filtra por eleição."""
    return servico.listar_habilitacoes(sessao, eleicao_id=eleicao_id)
