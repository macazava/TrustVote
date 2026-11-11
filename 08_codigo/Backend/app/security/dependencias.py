"""Dependências do FastAPI para saber quem está a fazer o pedido.

Uso nos routers:

    @router.get("", dependencies=[Depends(exigir_administrador)])

e, quando é preciso o utilizador em concreto:

    def endpoint(administrador: Utilizador = Depends(exigir_administrador)): ...

Para registar a ação na auditoria em nome de quem a fez:

    def endpoint(auditar: Auditor = Depends(auditor_administrador)):
        ...
        auditar("Eleição criada", "eleicao", eleicao.id, titulo=eleicao.titulo)
"""

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app import cache
from app.database import obter_sessao
from app.models.utilizador import Utilizador
from app.repositories import utilizador as repositorio_utilizador
from app.security.tokens import TokenInvalidoError, ler_token
from app.services.auditoria import Auditor

# auto_error=False para devolvermos a nossa própria mensagem em vez da do FastAPI.
esquema_bearer = HTTPBearer(auto_error=False)

SEM_AUTENTICACAO = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Autenticação necessária ou token inválido.",
    headers={"WWW-Authenticate": "Bearer"},
)


def conteudo_token(
    credenciais: HTTPAuthorizationCredentials | None = Depends(esquema_bearer),
) -> dict:
    """Conteúdo do token Bearer do pedido, se for válido e não tiver sido terminado."""
    if credenciais is None:
        raise SEM_AUTENTICACAO
    try:
        conteudo = ler_token(credenciais.credentials)
    except TokenInvalidoError as erro:
        raise SEM_AUTENTICACAO from erro
    if conteudo.get("jti") and cache.token_revogado(conteudo["jti"]):
        raise SEM_AUTENTICACAO
    return conteudo


def utilizador_atual(
    conteudo: dict = Depends(conteudo_token),
    sessao: Session = Depends(obter_sessao),
) -> Utilizador:
    """Devolve o utilizador dono do token Bearer do pedido."""
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


def ip_do_pedido(pedido: Request) -> str | None:
    """IP de quem fez o pedido; atrás do nginx vem no cabeçalho X-Real-IP."""
    ip = pedido.headers.get("x-real-ip") or (pedido.client.host if pedido.client else None)
    return ip[:45] if ip else None


def auditor_anonimo(pedido: Request, sessao: Session = Depends(obter_sessao)) -> Auditor:
    """Para pedidos sem sessão (registo, login)."""
    return Auditor(sessao, None, ip_do_pedido(pedido))


def auditor_utilizador(
    pedido: Request,
    sessao: Session = Depends(obter_sessao),
    utilizador: Utilizador = Depends(utilizador_atual),
) -> Auditor:
    return Auditor(sessao, utilizador.id, ip_do_pedido(pedido))


def auditor_administrador(
    pedido: Request,
    sessao: Session = Depends(obter_sessao),
    administrador: Utilizador = Depends(exigir_administrador),
) -> Auditor:
    return Auditor(sessao, administrador.id, ip_do_pedido(pedido))
