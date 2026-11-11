"""Endpoints da lista oficial de estudantes (só administradores)."""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.schemas.estudante_inscrito import (
    EstudantesLote,
    EstudantesLoteResposta,
    ListaInscritos,
)
from app.security.dependencias import auditor_administrador, exigir_administrador
from app.services import estudante_inscrito as servico
from app.services.auditoria import Auditor

estudante_inscrito_routers = APIRouter(
    prefix="/estudantes-inscritos",
    tags=["estudantes-inscritos"],
    dependencies=[Depends(exigir_administrador)],
)


@estudante_inscrito_routers.get("", response_model=ListaInscritos)
def listar_inscritos(sessao: Session = Depends(obter_sessao)):
    """Lista oficial e se o registo está restrito a ela."""
    return servico.listar(sessao)


@estudante_inscrito_routers.post("", response_model=EstudantesLoteResposta)
def adicionar_inscritos(
    dados: EstudantesLote,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Acrescenta números de estudante à lista oficial."""
    resposta = servico.adicionar_lote(sessao, dados.estudantes)
    auditar("Lista de inscritos atualizada", "estudante_inscrito", adicionados=resposta.adicionados)
    return resposta


@estudante_inscrito_routers.delete(
    "/{num_estudante}", status_code=status.HTTP_204_NO_CONTENT
)
def remover_inscrito(
    num_estudante: str,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Retira um número da lista oficial (a conta, se existir, mantém-se)."""
    servico.remover(sessao, num_estudante)
    auditar("Inscrito removido", "estudante_inscrito", num_estudante=num_estudante)
