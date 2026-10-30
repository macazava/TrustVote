"""Erros de negócio e a sua tradução para respostas HTTP.

As camadas de serviço levantam estas exceções; `registar_tratadores` liga cada
uma ao código HTTP correspondente, para os routers não repetirem try/except.
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse


class NaoEncontradoError(Exception):
    """O recurso indicado no pedido não existe."""


class RegistoDuplicadoError(Exception):
    """Já existe um registo com estes dados."""


class DadosInvalidosError(Exception):
    """Os dados recebidos violam uma regra de negócio."""


def registar_tratadores(app: FastAPI) -> None:
    """Liga cada erro de negócio ao código HTTP correspondente."""

    @app.exception_handler(NaoEncontradoError)
    async def _nao_encontrado(_pedido: Request, erro: NaoEncontradoError):
        return JSONResponse(
            status_code=status.HTTP_404_NOT_FOUND, content={"detail": str(erro)}
        )

    @app.exception_handler(RegistoDuplicadoError)
    async def _duplicado(_pedido: Request, erro: RegistoDuplicadoError):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT, content={"detail": str(erro)}
        )

    @app.exception_handler(DadosInvalidosError)
    async def _invalidos(_pedido: Request, erro: DadosInvalidosError):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST, content={"detail": str(erro)}
        )
