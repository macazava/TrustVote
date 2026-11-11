import asyncio
import contextlib
import hashlib
import os
import socket
import subprocess
import sys
from pathlib import Path

PASTA_BACKEND = Path(__file__).resolve().parent
PASTA_CODIGO = PASTA_BACKEND.parent
VENV = PASTA_CODIGO / ".venv"
PYTHON_VENV = VENV / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def _preparar_ambiente_local() -> None:
    """Prepara qualquer PC para `python main.py` (ou o botão "Run" do VS Code).

    1. Cria o .venv em 08_codigo e instala o requirements.txt (só quando muda).
    2. Cria o Backend/.env a partir do .env.example, com a password da BD e o
       JWT_SECRET do Infraestrutura/.env.
    3. Volta a correr este ficheiro com o Python do .venv.
    No Docker nada disto corre: o contentor arranca com `uvicorn main:app`.
    """
    if not PYTHON_VENV.exists():
        print("[TrustVote] A criar o ambiente virtual em", VENV)
        subprocess.check_call([sys.executable, "-m", "venv", str(VENV)])

    requisitos = PASTA_BACKEND / "requirements.txt"
    marca = VENV / ".requirements.sha256"
    resumo = hashlib.sha256(requisitos.read_bytes()).hexdigest()
    if not marca.exists() or marca.read_text() != resumo:
        print("[TrustVote] A instalar as dependências (só na primeira vez)...")
        subprocess.check_call([str(PYTHON_VENV), "-m", "pip", "install", "-q", "-r", str(requisitos)])
        marca.write_text(resumo)

    env_backend = PASTA_BACKEND / ".env"
    env_infra = PASTA_CODIGO / "Infraestrutura" / ".env"
    if not env_backend.exists() and env_infra.exists():
        infra = dict(
            linha.split("=", 1)
            for linha in env_infra.read_text(encoding="utf-8").splitlines()
            if "=" in linha and not linha.lstrip().startswith("#")
        )
        copiar = {
            "DATABASE_PASSWORD": infra.get("TRUSTVOTE_DB_PASSWORD", ""),
            "JWT_SECRET": infra.get("JWT_SECRET", ""),
        }
        linhas = [
            f"{linha.split('=', 1)[0]}={copiar[linha.split('=', 1)[0]]}"
            if linha.split("=", 1)[0] in copiar
            else linha
            for linha in (PASTA_BACKEND / ".env.example").read_text(encoding="utf-8").splitlines()
        ]
        env_backend.write_text("\n".join(linhas) + "\n", encoding="utf-8")
        print("[TrustVote] Criado o Backend/.env a partir do Infraestrutura/.env")

    # A API local usa a BD do Docker publicada em 127.0.0.1:15432 (compose.debug.yaml).
    def bd_publicada() -> bool:
        with socket.socket() as s:
            s.settimeout(1)
            return s.connect_ex(("127.0.0.1", 15432)) == 0

    if not bd_publicada():
        print("[TrustVote] A subir a base de dados no Docker (pode demorar 1-2 minutos)...")
        comando = ["docker", "compose", "-f", "compose.yaml", "-f", "compose.debug.yaml", "up", "-d", "--build", "--wait"]
        try:
            subprocess.call(comando, cwd=PASTA_CODIGO / "Infraestrutura")
        except FileNotFoundError:
            pass
        if not bd_publicada():
            print(
                "[TrustVote] ERRO: a base de dados não está acessível em 127.0.0.1:15432.\n"
                "  1. Abre o Docker Desktop e espera por 'Engine running'.\n"
                "  2. Confirma que existe o ficheiro Infraestrutura/.env.\n"
                "  3. Na pasta Infraestrutura corre: " + " ".join(comando)
            )
            sys.exit(1)

    os.chdir(PASTA_BACKEND)
    sys.exit(subprocess.call([str(PYTHON_VENV), str(Path(__file__).resolve())]))


if __name__ == "__main__" and Path(sys.prefix).resolve() != VENV.resolve():
    _preparar_ambiente_local()

import uvicorn
from fastapi import FastAPI, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import cache, migracoes, tarefas
from app.database import engine
from app.erros import registar_tratadores
from app.routers.auditoria_routers import auditoria_routers
from app.routers.auth_routers import auth_routers
from app.routers.eleicao_routers import eleicao_routers
from app.routers.estudante_inscrito_routers import estudante_inscrito_routers
from app.routers.mensagem_routers import mensagem_routers
from app.routers.sondagem_routers import sondagem_routers
from app.routers.utilizador_routers import utilizador_routers
from app.routers.votacao_routers import votacao_routers


@contextlib.asynccontextmanager
async def ciclo_de_vida(_app: FastAPI):
    """Aplica as migrações em falta e arranca as tarefas automáticas (app/tarefas.py).

    As migrações correm aqui porque a infraestrutura não tem um serviço próprio para elas:
    com duas instâncias, o lock na BD (app/migracoes.py) garante que só uma as aplica.
    """
    await asyncio.to_thread(migracoes.aplicar, engine)
    tarefa = asyncio.create_task(tarefas.correr_para_sempre()) if tarefas.INTERVALO > 0 else None
    yield
    if tarefa:
        tarefa.cancel()
        with contextlib.suppress(asyncio.CancelledError):
            await tarefa


# API_PREFIXO: caminho onde o nginx publica a API (/api no Docker). A documentação
# (/docs) e o "Try it out" usam-no para os pedidos chegarem à API e não ao site.
app = FastAPI(title="TrustVote API", lifespan=ciclo_de_vida, root_path=os.getenv("API_PREFIXO", ""))

# O site e a API partilham a origem do nginx (HTTPS na porta 8443), por isso o CORS só é
# preciso para quem chama a API a partir de outra origem.
CORS_ORIGINS = os.getenv(
    "CORS_ORIGINS",
    ",".join(f"https://{anfitriao}:8443" for anfitriao in ("127.0.0.1", "localhost")),
).split(",")

# Site aberto pelo IP do PC na rede local (192.168.x.x, 10.x.x.x, 172.16-31.x.x).
REDE_LOCAL = r"https?://(192\.168|10\.\d+|172\.(1[6-9]|2\d|3[01]))\.\d+\.\d+:8443"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origem.strip() for origem in CORS_ORIGINS if origem.strip()],
    allow_origin_regex=REDE_LOCAL,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
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
app.include_router(mensagem_routers)


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


if __name__ == "__main__":
    print("[TrustVote] API local em http://127.0.0.1:8001/docs")
    uvicorn.run(app, host="127.0.0.1", port=8001)
