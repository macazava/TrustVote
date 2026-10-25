from fastapi import APIRouter, Request, status

from app.models.utilizador import PERFIS
from app.repositories import utilizador as repo_utilizador
from app.schemas.autenticacao import (LoginIn, RegistoIn, TokenOut, TotpCodigoIn, TotpConfigOut,
                                      UtilizadorAtualizarIn, UtilizadorOut)
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
