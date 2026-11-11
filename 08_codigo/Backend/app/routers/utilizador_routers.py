"""Endpoints de gestão de utilizadores (só administradores)."""

from typing import Literal

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.models.utilizador import Utilizador
from app.schemas.autenticacao import (
    PasswordTemporaria,
    UtilizadorAlterar,
    UtilizadorDetalhe,
)
from app.security.dependencias import auditor_administrador, exigir_administrador
from app.services import autenticacao as servico_autenticacao
from app.services import utilizador as servico
from app.services.auditoria import Auditor

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
    auditar: Auditor = Depends(auditor_administrador),
):
    """Suspende, reativa ou muda o perfil de uma conta."""
    utilizador = servico.atualizar_utilizador(sessao, utilizador_id, dados, administrador)
    auditar("Conta alterada", "utilizador", utilizador.id, **dados.model_dump(exclude_unset=True))
    return utilizador


@utilizador_routers.post("/{utilizador_id}/repor-password", response_model=PasswordTemporaria)
def repor_password(
    utilizador_id: int,
    sessao: Session = Depends(obter_sessao),
    administrador: Utilizador = Depends(exigir_administrador),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Gera uma palavra-passe temporária para a conta."""
    temporaria = servico_autenticacao.repor_password(sessao, utilizador_id, administrador)
    auditar("Palavra-passe reposta", "utilizador", utilizador_id)
    return PasswordTemporaria(password_temporaria=temporaria)
