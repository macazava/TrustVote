import os

import uvicorn
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app.database import engine
from app.erros import registar_tratadores
from app.routers.auth_routers import auth_routers
from app.routers.candidato_routers import candidato_routers
from app.routers.eleicao_routers import eleicao_routers
from app.routers.habilitacao_routers import habilitacao_routers
from app.routers.order_routers import order_router
from app.routers.ronda_candidato_routers import ronda_candidato_routers
from app.routers.ronda_routers import ronda_routers
from app.routers.utilizador_routers import utilizador_routers
from app.routers.votacao_routers import votacao_routers

app = FastAPI()

# Único endereço do frontend: o Live Server.
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://127.0.0.1:5500").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origem.strip() for origem in CORS_ORIGINS if origem.strip()],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Converte os erros de negócio definidos em app/erros.py em respostas HTTP.
registar_tratadores(app)

app.include_router(auth_routers)
app.include_router(order_router)
app.include_router(eleicao_routers)
app.include_router(candidato_routers)
app.include_router(ronda_routers)
app.include_router(ronda_candidato_routers)
app.include_router(habilitacao_routers)
app.include_router(utilizador_routers)
app.include_router(votacao_routers)


@app.get("/")
def oi_trustvote() -> dict:
    return {"message": "TrustVote API está a correr!"}


@app.get("/health")
def health() -> JSONResponse:
    """Healthcheck da infraestrutura: devolve 503 sem acesso à base de dados."""
    try:
        with engine.connect() as ligacao:
            ligacao.execute(text("SELECT 1"))
        base_dados = "ok"
    except SQLAlchemyError:
        base_dados = "erro"
    return JSONResponse(
        status_code=(
            status.HTTP_200_OK
            if base_dados == "ok"
            else status.HTTP_503_SERVICE_UNAVAILABLE
        ),
        content={
            "status": "ok" if base_dados == "ok" else "degradado",
            "instance": os.getenv("APP_INSTANCE", "local"),
            "database": base_dados,
        },
    )


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
