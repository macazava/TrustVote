"""Dependências do FastAPI para saber quem está a fazer o pedido.

Uso nos routers:

    @router.get("", dependencies=[Depends(exigir_administrador)])

e, quando é preciso o utilizador em concreto:

    def endpoint(administrador: Utilizador = Depends(exigir_administrador)): ...
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.models.utilizador import Utilizador
from app.repositories import utilizador as repositorio_utilizador
from app.security.tokens import TokenInvalidoError, ler_token

# auto_error=False para devolvermos a nossa própria mensagem em vez da do FastAPI.
esquema_bearer = HTTPBearer(auto_error=False)

SEM_AUTENTICACAO = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Autenticação necessária ou token inválido.",
    headers={"WWW-Authenticate": "Bearer"},
)


def utilizador_atual(
    credenciais: HTTPAuthorizationCredentials | None = Depends(esquema_bearer),
    sessao: Session = Depends(obter_sessao),
) -> Utilizador:
    """Devolve o utilizador dono do token Bearer do pedido."""
    if credenciais is None:
        raise SEM_AUTENTICACAO

    try:
        conteudo = ler_token(credenciais.credentials)
    except TokenInvalidoError as erro:
        raise SEM_AUTENTICACAO from erro

    utilizador = repositorio_utilizador.obter_por_id(sessao, int(conteudo["sub"]))
    if utilizador is None or not utilizador.ativo:
        raise SEM_AUTENTICACAO
    return utilizador


def exigir_administrador(
    utilizador: Utilizador = Depends(utilizador_atual),
) -> Utilizador:
    """Só deixa passar quem tem ut_perfil = 'administrador'."""
    if utilizador.perfil != "administrador":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Esta operação é só para administradores.",
        )
    return utilizador
