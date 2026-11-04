from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app import cache
from app.database import obter_sessao
from app.models.utilizador import Utilizador
from app.schemas.autenticacao import (
    AlterarPassword,
    LoginPedido,
    TokenResposta,
    UtilizadorCriar,
    UtilizadorDetalhe,
    UtilizadorResposta,
)
from app.security import tokens
from app.security.dependencias import (
    auditor_anonimo,
    auditor_utilizador,
    conteudo_token,
    utilizador_atual,
)
from app.services import autenticacao as servico_autenticacao
from app.services.auditoria import Auditor

auth_routers = APIRouter(prefix="/auth", tags=["auth"])


@auth_routers.post("/login", response_model=TokenResposta)
def login(
    dados: LoginPedido,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_anonimo),
):
    """Devolve um token de acesso para as credenciais indicadas."""
    try:
        utilizador = servico_autenticacao.autenticar_utilizador(sessao, dados)
    except servico_autenticacao.CredenciaisInvalidasError as erro:
        auditar("Início de sessão falhado", "utilizador", email=dados.email)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(erro)
        )
    auditar.utilizador_id = utilizador.id
    auditar("Sessão iniciada", "utilizador", utilizador.id)
    return TokenResposta(
        access_token=tokens.criar_token(utilizador),
        expires_in=tokens.MINUTOS_VALIDADE * 60,
    )


@auth_routers.get("/eu", response_model=UtilizadorDetalhe)
def eu(utilizador: Utilizador = Depends(utilizador_atual)):
    """Devolve os dados do utilizador autenticado."""
    return utilizador


@auth_routers.post(
    "/register",
    response_model=UtilizadorResposta,
    status_code=status.HTTP_201_CREATED,
)
def register(
    dados: UtilizadorCriar,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_anonimo),
):
    """Cria a conta de um estudante e habilita-o nas eleições não encerradas."""
    try:
        utilizador = servico_autenticacao.registar_utilizador(sessao, dados)
    except servico_autenticacao.DadosJaExistemError as erro:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(erro))
    auditar.utilizador_id = utilizador.id
    auditar("Conta criada", "utilizador", utilizador.id)
    return utilizador


@auth_routers.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(conteudo: dict = Depends(conteudo_token)):
    """Termina a sessão: o token deixa de ser aceite, mesmo antes de expirar."""
    if conteudo.get("jti"):
        cache.revogar_token(conteudo["jti"], tokens.segundos_restantes(conteudo))


@auth_routers.post("/password", status_code=status.HTTP_204_NO_CONTENT)
def alterar_password(
    dados: AlterarPassword,
    sessao: Session = Depends(obter_sessao),
    utilizador: Utilizador = Depends(utilizador_atual),
    auditar: Auditor = Depends(auditor_utilizador),
):
    """Muda a palavra-passe da própria conta."""
    servico_autenticacao.alterar_password(sessao, utilizador, dados.atual, dados.nova)
    auditar("Palavra-passe alterada", "utilizador", utilizador.id)
