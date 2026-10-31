"""Erros de negócio e a sua tradução para respostas HTTP.

As camadas de serviço levantam estas exceções; `registar_tratadores` liga cada
uma ao código HTTP correspondente, para os routers não repetirem try/except.
"""

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from sqlalchemy.exc import InternalError, OperationalError


class NaoEncontradoError(Exception):
    """O recurso indicado no pedido não existe."""


class RegistoDuplicadoError(Exception):
    """Já existe um registo com estes dados."""


class DadosInvalidosError(Exception):
    """Os dados recebidos violam uma regra de negócio."""


class EstadoInvalidoError(Exception):
    """A operação não é compatível com o estado atual do recurso."""


class SemPermissaoError(Exception):
    """O utilizador não pode fazer esta operação."""


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

    # Durante um failover nenhum nó aceita escritas: o pedido pode ser repetido.
    @app.exception_handler(OperationalError)
    @app.exception_handler(InternalError)
    async def _base_dados_indisponivel(_pedido: Request, _erro: Exception):
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "detail": "Base de dados temporariamente indisponível. "
                "Tente novamente dentro de momentos."
            },
        )

    @app.exception_handler(EstadoInvalidoError)
    async def _estado_invalido(_pedido: Request, erro: EstadoInvalidoError):
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT, content={"detail": str(erro)}
        )

    @app.exception_handler(SemPermissaoError)
    async def _sem_permissao(_pedido: Request, erro: SemPermissaoError):
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN, content={"detail": str(erro)}
        )

    @app.exception_handler(DadosInvalidosError)
    async def _invalidos(_pedido: Request, erro: DadosInvalidosError):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST, content={"detail": str(erro)}
        )
