"""Endpoints da auditoria (só administradores)."""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.schemas.auditoria import AuditoriaResposta, VerificacaoCadeia
from app.security.dependencias import exigir_administrador
from app.services import auditoria as servico

auditoria_routers = APIRouter(
    prefix="/auditoria",
    tags=["auditoria"],
    dependencies=[Depends(exigir_administrador)],
)


@auditoria_routers.get("", response_model=list[AuditoriaResposta])
def listar_auditoria(
    limite: int = Query(200, ge=1, le=5000), sessao: Session = Depends(obter_sessao)
):
    """Os registos mais recentes primeiro."""
    return servico.listar(sessao, limite=limite)


@auditoria_routers.get("/verificar", response_model=VerificacaoCadeia)
def verificar_auditoria(sessao: Session = Depends(obter_sessao)):
    """Recalcula a cadeia de hashes e indica o primeiro registo adulterado."""
    return servico.verificar_cadeia(sessao)
