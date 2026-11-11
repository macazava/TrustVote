"""Regras de negócio da gestão de utilizadores."""

from sqlalchemy.orm import Session

from app.database import gravar
from app.erros import DadosInvalidosError, NaoEncontradoError
from app.models.utilizador import Utilizador
from app.repositories import utilizador as repositorio
from app.schemas.autenticacao import UtilizadorAlterar


def listar_utilizadores(sessao: Session, perfil: str | None = None) -> list[Utilizador]:
    return repositorio.listar(sessao, perfil=perfil)


def atualizar_utilizador(
    sessao: Session,
    utilizador_id: int,
    dados: UtilizadorAlterar,
    administrador: Utilizador,
) -> Utilizador:
    """Suspende, reativa ou muda o perfil de uma conta."""
    utilizador = repositorio.obter_por_id(sessao, utilizador_id)
    if utilizador is None:
        raise NaoEncontradoError(f"Não existe o utilizador {utilizador_id}.")

    # Evita que a equipa fique sem nenhum administrador por engano.
    if utilizador.id == administrador.id:
        raise DadosInvalidosError("Não pode alterar a sua própria conta.")

    for campo, valor in dados.model_dump(exclude_unset=True).items():
        setattr(utilizador, campo, valor)
    return gravar(sessao, utilizador)
