"""Regras de acesso usadas pelos routers (FastAPI Depends)."""
from typing import Annotated

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Utilizador
from app.security.estado_partilhado import token_revogado
from app.security.tokens import TokenInvalido, validar_token

_bearer = HTTPBearer(auto_error=False)

DbSession = Annotated[Session, Depends(get_db)]


def utilizador_atual(db: DbSession, request: Request,
                     cred: Annotated[HTTPAuthorizationCredentials | None, Depends(_bearer)]) -> Utilizador:
    erro = HTTPException(status.HTTP_401_UNAUTHORIZED, "Não autenticado",
                         headers={"WWW-Authenticate": "Bearer"})
    if cred is None:
        raise erro
    try:
        payload = validar_token(cred.credentials)
        utilizador_id = int(payload["sub"])
    except (TokenInvalido, ValueError):
        raise erro
    if token_revogado(payload.get("jti"), utilizador_id, payload.get("emitido_ms")):
        raise erro  # logout ou password alterada
    request.state.token = payload  # usado pelo logout
    # O perfil e o estado ativo vêm sempre da BD (não do token): uma conta desativada ou
    # despromovida perde o acesso logo, sem esperar que o token expire.
    utilizador = db.get(Utilizador, utilizador_id)
    if utilizador is None or not utilizador.ativo:
        raise erro
    return utilizador


UtilizadorAtual = Annotated[Utilizador, Depends(utilizador_atual)]


def apenas_admin(utilizador: UtilizadorAtual) -> Utilizador:
    if not utilizador.is_admin:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Apenas administradores")
    return utilizador


Admin = Annotated[Utilizador, Depends(apenas_admin)]
