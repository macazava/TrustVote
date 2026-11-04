import asyncio
import contextlib
import os

from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import cache, tarefas
from app.database import engine
from app.erros import registar_tratadores
from app.routers.auditoria_routers import auditoria_routers
from app.routers.auth_routers import auth_routers
from app.routers.eleicao_routers import eleicao_routers
from app.routers.estudante_inscrito_routers import estudante_inscrito_routers
from app.routers.sondagem_routers import sondagem_routers
from app.routers.utilizador_routers import utilizador_routers
from app.routers.votacao_routers import votacao_routers


@contextlib.asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    """Arranca as tarefas automáticas (app/tarefas.py) enquanto a API corre."""
    tarefa = asyncio.create_task(tarefas.correr_para_sempre()) if tarefas.INTERVALO > 0 else None
    yield
    if tarefa:
        tarefa.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await tarefa


# API_PREFIXO: caminho onde o nginx publica a API (/api no Docker). A documentação
# (/docs) e o "Try it out" usam-no para os pedidos chegarem à API e não ao site.
app = FastAPI(title="TrustVote API", lifespan=ciclo_de_vida, root_path=os.getenv("API_PREFIXO", ""))

# O site é servido pela entrada (8080) e pelos dois nginx (8081/8082). Cada página chama a
# API da sua origem; as outras só servem de recurso, e por isso também estão autorizadas.
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    ",".join(f"http://{anfitriao}:{porta}" for porta in (8080, 8081, 8082) for anfitriao in ("127.0.0.1", "localhost")),
).split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origem.strip() for origem in CORS_ORIGINS if origem.strip()],
    allow_methods=["GET", "POST", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

# Converte os erros de negócio definidos em app/erros.py em respostas HTTP.
registar_tratadores(app)

app.include_router(auth_routers)
app.include_router(eleicao_routers)
app.include_router(sondagem_routers)
app.include_router(auditoria_routers)
app.include_router(estudante_inscrito_routers)
app.include_router(utilizador_routers)
app.include_router(votacao_routers)


@app.get("/health")
def health() -> JSONResponse:
    """Healthcheck da infraestrutura: devolve 503 sem acesso à base de dados.

    O Redis é só informativo: sem ele a votação continua a funcionar.
    """
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
            "redis": (
                "desligado"
                if not cache.CONFIGURADO
                else "ok" if cache.disponivel() else "erro"
            ),
        },
    )
