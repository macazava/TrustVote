"""Regras de negócio da autenticação."""

from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.models.utilizador import Utilizador
from app.repositories import eleicao as repositorio_eleicao
from app.repositories import habilitacao as repositorio_habilitacao
from app.repositories import utilizador as repositorio
from app.schemas.autenticacao import LoginPedido, UtilizadorCriar

# Argon2 é o algoritmo recomendado pelo pwdlib.
_hasher = PasswordHash.recommended()


class DadosJaExistemError(Exception):
    """O nome de utilizador ou o email já estão registados."""


class CredenciaisInvalidasError(Exception):
    """O utilizador não existe, a password está errada ou a conta está inativa."""


def registar_utilizador(sessao: Session, dados: UtilizadorCriar) -> Utilizador:
    """Cria um utilizador novo, com a password guardada em hash Argon2."""
    if repositorio.obter_por_nome_utilizador(sessao, dados.nome_utilizador) is not None:
        raise DadosJaExistemError("Esse nome de utilizador já está registado.")

    if repositorio.obter_por_email(sessao, dados.email) is not None:
        raise DadosJaExistemError("Esse email já está registado.")

    if repositorio.obter_por_num_estudante(sessao, dados.num_estudante) is not None:
        raise DadosJaExistemError("Esse número de estudante já está registado.")

    utilizador = repositorio.criar(
        sessao,
        nome_utilizador=dados.nome_utilizador,
        email=dados.email,
        num_estudante=dados.num_estudante,
        curso=dados.curso,
        password_hash=_hasher.hash(dados.password),
    )
    _habilitar_nas_eleicoes_nao_encerradas(sessao, utilizador.id)
    return utilizador


def _habilitar_nas_eleicoes_nao_encerradas(
    sessao: Session, utilizador_id: int
) -> None:
    """Habilita o novo eleitor a votar em todas as eleições ainda não encerradas."""
    for eleicao in repositorio_eleicao.listar_para_habilitacao(sessao):
        repositorio_habilitacao.criar(
            sessao, eleicao_id=eleicao.id, utilizador_id=utilizador_id
        )


def autenticar_utilizador(sessao: Session, dados: LoginPedido) -> Utilizador:
    """Confirma as credenciais e devolve o utilizador correspondente.

    A mesma mensagem de erro serve para os três casos, para não revelar se o
    nome de utilizador existe.
    """
    utilizador = repositorio.obter_por_nome_utilizador(sessao, dados.nome_utilizador)
    if (
        utilizador is None
        or not utilizador.ativo
        or not _hasher.verify(dados.password, utilizador.password_hash)
    ):
        raise CredenciaisInvalidasError("Nome de utilizador ou password incorretos.")
    return utilizador
