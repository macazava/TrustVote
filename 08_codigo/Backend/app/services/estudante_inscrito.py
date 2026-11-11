"""Regras de negócio da lista oficial de estudantes.

Com a variável de ambiente REGISTO_RESTRITO=true, só os números desta lista
podem criar conta. Por omissão o registo é aberto, como até aqui.
"""

import os

from sqlalchemy.orm import Session

from app.database import apagar
from app.erros import NaoEncontradoError
from app.models.estudante_inscrito import EstudanteInscrito
from app.repositories import estudante_inscrito as repositorio
from app.repositories import utilizador as repositorio_utilizador
from app.schemas.estudante_inscrito import (
    EstudanteNovo,
    EstudanteResposta,
    EstudantesLoteResposta,
    ListaInscritos,
)

REGISTO_RESTRITO = os.getenv("REGISTO_RESTRITO", "false").strip().lower() in (
    "1",
    "true",
    "sim",
)


def pode_registar(sessao: Session, num_estudante: str) -> bool:
    return not REGISTO_RESTRITO or repositorio.obter(sessao, num_estudante) is not None


def listar(sessao: Session) -> ListaInscritos:
    registados = {
        utilizador.num_estudante for utilizador in repositorio_utilizador.listar(sessao)
    }
    return ListaInscritos(
        restrito=REGISTO_RESTRITO,
        estudantes=[
            EstudanteResposta(
                **EstudanteResposta.model_validate(estudante).model_dump(
                    exclude={"registado"}
                ),
                registado=estudante.num_estudante in registados,
            )
            for estudante in repositorio.listar(sessao)
        ],
    )


def adicionar_lote(
    sessao: Session, estudantes: list[EstudanteNovo]
) -> EstudantesLoteResposta:
    """Acrescenta à lista; os números que já lá estavam ficam como estavam."""
    novos: dict[str, EstudanteInscrito] = {}
    ja_existiam = 0
    for dados in estudantes:
        if dados.num_estudante in novos or repositorio.obter(sessao, dados.num_estudante):
            ja_existiam += 1
            continue
        novos[dados.num_estudante] = EstudanteInscrito(**dados.model_dump())
    repositorio.adicionar(sessao, list(novos.values()))
    return EstudantesLoteResposta(adicionados=len(novos), ja_existiam=ja_existiam)


def remover(sessao: Session, num_estudante: str) -> None:
    estudante = repositorio.obter(sessao, num_estudante)
    if estudante is None:
        raise NaoEncontradoError("Esse número não está na lista de inscritos.")
    apagar(sessao, estudante)
