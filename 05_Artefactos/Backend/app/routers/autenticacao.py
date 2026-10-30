from fastapi import APIRouter, Request, status

from app.models.utilizador import PERFIS
from app.repositories import utilizador as repo_utilizador
from app.config import get_settings
from app.schemas.autenticacao import (CodigoResetOut, LoginIn, PasswordAlterarIn, PasswordRedefinirIn, RegistoIn,
                                      TokenOut, TotpCodigoIn, TotpConfigOut, UtilizadorAtualizarIn, UtilizadorOut)
from app.security.dependencias import Admin, DbSession, UtilizadorAtual
from app.services import autenticacao as servico
from app.services.erros import DadosInvalidos

router = APIRouter(prefix="/auth", tags=["autenticação"])
router_utilizadores = APIRouter(prefix="/utilizadores", tags=["utilizadores (admin)"])


def ip_cliente(request: Request) -> str | None:
    # Atrás do nginx o IP real vem em X-Real-IP (o backend não está exposto diretamente).
    return request.headers.get("x-real-ip") or (request.client.host if request.client else None)


@router.post("/registo", response_model=UtilizadorOut, status_code=status.HTTP_201_CREATED)
def registo(dados: RegistoIn, db: DbSession, request: Request):
    """Cria uma conta de eleitor."""
    return servico.registar(db, dados.nome, dados.email, dados.password, ip=ip_cliente(request))


@router.post("/login", response_model=TokenOut)
def login(dados: LoginIn, db: DbSession, request: Request):
    """Devolve um token JWT (RS256). Se o TOTP estiver ativo, envie também codigo_totp."""
    token, expira = servico.login(db, dados.email, dados.password, dados.codigo_totp, ip=ip_cliente(request))
    return TokenOut(access_token=token, expires_in=expira)


@router.get("/eu", response_model=UtilizadorOut)
def eu(utilizador: UtilizadorAtual):
    return utilizador


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(utilizador: UtilizadorAtual, db: DbSession, request: Request):
    """Invalida o token usado neste pedido (nas duas instâncias, via Redis)."""
    servico.logout(db, utilizador, request.state.token, ip=ip_cliente(request))


@router.post("/password/alterar", status_code=status.HTTP_204_NO_CONTENT)
def alterar_password(dados: PasswordAlterarIn, utilizador: UtilizadorAtual, db: DbSession, request: Request):
    """Muda a password e termina todas as sessões abertas (é preciso fazer login de novo)."""
    servico.alterar_password(db, utilizador, dados.password_atual, dados.nova_password, ip=ip_cliente(request))


@router.post("/password/redefinir", status_code=status.HTTP_204_NO_CONTENT)
def redefinir_password(dados: PasswordRedefinirIn, db: DbSession, request: Request):
    """Recuperar o acesso sem a password: com o código dado por um admin (codigo_reset)
    ou com o código da app autenticadora (codigo_totp), se o TOTP estiver ativo."""
    servico.redefinir_password(db, dados.email, dados.nova_password, codigo_reset=dados.codigo_reset,
                               codigo_totp=dados.codigo_totp, ip=ip_cliente(request))


@router.post("/totp/configurar", response_model=TotpConfigOut)
def totp_configurar(utilizador: UtilizadorAtual, db: DbSession):
    """Gera o segredo TOTP. Ler o `uri` como QR code na app autenticadora e confirmar em /totp/ativar."""
    segredo, uri = servico.configurar_totp(db, utilizador)
    return TotpConfigOut(segredo=segredo, uri=uri)


@router.post("/totp/ativar", status_code=status.HTTP_204_NO_CONTENT)
def totp_ativar(dados: TotpCodigoIn, utilizador: UtilizadorAtual, db: DbSession, request: Request):
    servico.ativar_totp(db, utilizador, dados.codigo, ip=ip_cliente(request))


@router.post("/totp/desativar", status_code=status.HTTP_204_NO_CONTENT)
def totp_desativar(dados: TotpCodigoIn, utilizador: UtilizadorAtual, db: DbSession, request: Request):
    servico.desativar_totp(db, utilizador, dados.codigo, ip=ip_cliente(request))


@router_utilizadores.get("", response_model=list[UtilizadorOut])
def listar_utilizadores(_: Admin, db: DbSession, perfil: str | None = None):
    if perfil is not None and perfil not in PERFIS:
        raise DadosInvalidos(f"perfil deve ser um de {PERFIS}")
    return repo_utilizador.listar(db, perfil)


@router_utilizadores.patch("/{utilizador_id}", response_model=UtilizadorOut)
def atualizar_utilizador(utilizador_id: int, dados: UtilizadorAtualizarIn, admin: Admin, db: DbSession):
    """Mudar o perfil (eleitor/administrador) ou ativar/desativar uma conta."""
    return servico.atualizar_utilizador(db, admin, utilizador_id, perfil=dados.perfil, ativo=dados.ativo)


@router_utilizadores.post("/{utilizador_id}/codigo-reset", response_model=CodigoResetOut)
def codigo_reset(utilizador_id: int, admin: Admin, db: DbSession):
    """Gera um código de uso único para o utilizador repor a password em /auth/password/redefinir."""
    codigo = servico.gerar_codigo_reset(db, admin, utilizador_id)
    return CodigoResetOut(codigo=codigo, expira_em_minutos=get_settings().reset_codigo_minutos)
