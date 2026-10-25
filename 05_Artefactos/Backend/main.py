import os

import uvicorn
from fastapi import FastAPI

from app.erros import registar_tratadores
from app.routers.auth_routers import auth_routers
from app.routers.candidato_routers import candidato_routers
from app.routers.eleicao_routers import eleicao_routers
from app.routers.habilitacao_routers import habilitacao_routers
from app.routers.order_routers import order_router
from app.routers.ronda_candidato_routers import ronda_candidato_routers
from app.routers.ronda_routers import ronda_routers

app = FastAPI()

# Converte os erros de negócio definidos em app/erros.py em respostas HTTP.
registar_tratadores(app)

app.include_router(auth_routers)
app.include_router(order_router)
app.include_router(eleicao_routers)
app.include_router(candidato_routers)
app.include_router(ronda_routers)
app.include_router(ronda_candidato_routers)
app.include_router(habilitacao_routers)


@app.get("/")
def oi_trustvote() -> dict:
    return {"message": "TrustVote API está a correr!"}


@app.get("/health")
def health() -> dict:
    """Healthcheck da infraestrutura: devolve 200 quando a instância está pronta."""
    return {"status": "ok", "instance": os.getenv("APP_INSTANCE", "local")}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
