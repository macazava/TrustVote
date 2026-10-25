from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.schemas.autenticacao import (
    LoginPedido,
    TokenResposta,
    UtilizadorCriar,
    UtilizadorResposta,
)
from app.security import tokens
from app.services import autenticacao as servico_autenticacao

auth_routers = APIRouter(prefix="/auth", tags=["auth"])


@auth_routers.get("/")
async def home():
    """Endpoint para a página inicial."""
    return {"message": "Bem-vindo à página inicial"}


@auth_routers.post("/login", response_model=TokenResposta)
async def login(dados: LoginPedido, sessao: Session = Depends(obter_sessao)):
    """Devolve um token de acesso para as credenciais indicadas."""
    try:
        utilizador = servico_autenticacao.autenticar_utilizador(sessao, dados)
    except servico_autenticacao.CredenciaisInvalidasError as erro:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail=str(erro)
        )
    return TokenResposta(access_token=tokens.criar_token(utilizador))


@auth_routers.post(
    "/register",
    response_model=UtilizadorResposta,
    status_code=status.HTTP_201_CREATED,
)
async def register(dados: UtilizadorCriar, sessao: Session = Depends(obter_sessao)):
    """Endpoint para o registo de um novo utilizador."""
    try:
        return servico_autenticacao.registar_utilizador(sessao, dados)
    except servico_autenticacao.DadosJaExistemError as erro:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(erro))


@auth_routers.post("/logout")
async def logout():
    """Endpoint para o logout."""
    return {"message": "Logout realizado com sucesso"}


@auth_routers.post("/reset-password")
async def reset_password():
    """Endpoint para a resetação de senha."""
    return {"message": "Registro realizado com sucesso"}


@auth_routers.post("/verify-password")
async def verify_password():
    """Endpoint para a verificação de senha."""
    return {"message": "Verificação de senha realizada com sucesso"}
