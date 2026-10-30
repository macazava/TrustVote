"""Endpoints de gestão de utilizadores (só administradores)."""

from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.models.utilizador import Utilizador
from app.schemas.autenticacao import UtilizadorAlterar, UtilizadorDetalhe
from app.security.dependencias import exigir_administrador
from app.services import utilizador as servico

utilizador_routers = APIRouter(
    prefix="/utilizadores",
    tags=["utilizadores"],
    dependencies=[Depends(exigir_administrador)],
)


@utilizador_routers.get("", response_model=list[UtilizadorDetalhe])
def listar_utilizadores(
    perfil: Literal["eleitor", "administrador"] | None = None,
    sessao: Session = Depends(obter_sessao),
):
    """Lista os utilizadores; com `perfil` filtra por perfil."""
    return servico.listar_utilizadores(sessao, perfil=perfil)


@utilizador_routers.patch("/{utilizador_id}", response_model=UtilizadorDetalhe)
def atualizar_utilizador(
    utilizador_id: int,
    dados: UtilizadorAlterar,
    sessao: Session = Depends(obter_sessao),
    administrador: Utilizador = Depends(exigir_administrador),
):
    """Suspende, reativa ou muda o perfil de uma conta."""
    return servico.atualizar_utilizador(sessao, utilizador_id, dados, administrador)
