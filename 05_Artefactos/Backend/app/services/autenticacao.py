"""Regras de negócio da autenticação."""

import secrets

from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app import cache
from app.database import gravar
from app.erros import (
    DadosInvalidosError,
    MuitasTentativasError,
    NaoEncontradoError,
    SemPermissaoError,
)
from app.models.utilizador import Utilizador
from app.repositories import eleicao as repositorio_eleicao
from app.repositories import habilitacao as repositorio_habilitacao
from app.repositories import utilizador as repositorio
from app.schemas.autenticacao import LoginPedido, UtilizadorCriar
from app.services import estudante_inscrito as servico_inscritos

# Argon2 é o algoritmo recomendado pelo pwdlib.
_hasher = PasswordHash.recommended()

# Mensagem que o frontend reconhece para mostrar o campo do código.


class DadosJaExistemError(Exception):
    """O nome de utilizador ou o email já estão registados."""


class CredenciaisInvalidasError(Exception):
    """O utilizador não existe, a password está errada ou a conta está inativa."""


def registar_utilizador(sessao: Session, dados: UtilizadorCriar) -> Utilizador:
    """Cria um utilizador novo, com a password guardada em hash Argon2."""
    if not servico_inscritos.pode_registar(sessao, dados.num_estudante):
        raise SemPermissaoError(
            "Esse número de estudante não consta da lista oficial de inscritos."
        )

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
    """Confirma as credenciais e devolve o utilizador.

    A mesma mensagem de erro serve para todos os casos, para não revelar se o
    email existe. Depois de LOGIN_TENTATIVAS falhas seguidas, o email fica
    bloqueado durante LOGIN_JANELA_SEGUNDOS (contado no Redis).
    """
    if cache.login_bloqueado(dados.email):
        raise MuitasTentativasError(
            "Demasiadas tentativas falhadas. Tente novamente dentro de alguns minutos."
        )

    utilizador = repositorio.obter_por_email(sessao, dados.email)
    if (
        utilizador is None
        or not utilizador.ativo
        or not _hasher.verify(dados.password, utilizador.password_hash)
    ):
        cache.registar_falha_login(dados.email)
        raise CredenciaisInvalidasError("E-mail ou palavra-passe incorretos.")

    cache.limpar_falhas_login(dados.email)
    return utilizador


# ===== Palavras-passe =====
def alterar_password(
    sessao: Session, utilizador: Utilizador, atual: str, nova: str
) -> Utilizador:
    if not _hasher.verify(atual, utilizador.password_hash):
        raise DadosInvalidosError("A palavra-passe atual está errada.")
    if not any(c.isalpha() for c in nova) or not any(c.isdigit() for c in nova):
        raise DadosInvalidosError("A nova palavra-passe tem de ter letras e números.")
    utilizador.password_hash = _hasher.hash(nova)
    return gravar(sessao, utilizador)


def repor_password(
    sessao: Session, utilizador_id: int, administrador: Utilizador
) -> str:
    """Define uma palavra-passe temporária, que o administrador entrega ao estudante."""
    utilizador = repositorio.obter_por_id(sessao, utilizador_id)
    if utilizador is None:
        raise NaoEncontradoError(f"Não existe o utilizador {utilizador_id}.")
    if utilizador.id == administrador.id:
        raise DadosInvalidosError("Use 'Alterar palavra-passe' para a sua própria conta.")
    temporaria = f"Tv{secrets.token_urlsafe(9)}7"
    utilizador.password_hash = _hasher.hash(temporaria)
    gravar(sessao, utilizador)
    return temporaria
