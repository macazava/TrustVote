import os
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.config import get_settings
from app.database import get_engine
from app.routers import autenticacao, eleicoes, votacao
from app.services.erros import ErroNegocio


@asynccontextmanager
async def lifespan(_: FastAPI):
    get_settings()  # falha logo no arranque se faltar configuração (chaves JWT/TOTP)
    yield


app = FastAPI(title="TrustVote API", lifespan=lifespan)

app.include_router(autenticacao.router)
app.include_router(autenticacao.router_utilizadores)
app.include_router(eleicoes.router)
app.include_router(votacao.router)
app.include_router(votacao.router_auditoria)


@app.exception_handler(ErroNegocio)
def erro_negocio(_: Request, erro: ErroNegocio) -> JSONResponse:
    headers = {"WWW-Authenticate": "Bearer"} if erro.status_code == 401 else None
    return JSONResponse({"detail": erro.mensagem}, status_code=erro.status_code, headers=headers)


@app.get("/")
def oi_trustvote() -> dict:
    return {"message": "TrustVote API está a correr!"}


@app.get("/health")
def health() -> JSONResponse:
    """Usado pelo healthcheck do Docker e pelo nginx: 200 se a instância chega à BD, senão 503."""
    instancia = get_settings().app_instance
    try:
        with get_engine().connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse({"status": "erro", "instance": instancia, "database": "indisponivel"}, status_code=503)
    return JSONResponse({"status": "ok", "instance": instancia, "database": "ok"})


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("APP_PORT", "8080")))
