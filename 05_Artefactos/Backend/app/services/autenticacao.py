"""Regras de negócio da autenticação."""

from pwdlib import PasswordHash
from sqlalchemy.orm import Session

from app.erros import DadosInvalidosError
from app.models.utilizador import Utilizador
from app.repositories import eleicao as repositorio_eleicao
from app.repositories import habilitacao as repositorio_habilitacao
from app.repositories import utilizador as repositorio
from app.schemas.autenticacao import (
    LoginPedido,
    TotpConfiguracaoResposta,
    TotpEstadoResposta,
    UtilizadorCriar,
)
from app.security import totp as totp_seguranca

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
    email existe.
    """
    utilizador = repositorio.obter_por_email(sessao, dados.email)
    if (
        utilizador is None
        or not utilizador.ativo
        or not _hasher.verify(dados.password, utilizador.password_hash)
    ):
        raise CredenciaisInvalidasError("E-mail ou palavra-passe incorretos.")
    return utilizador


def configurar_totp(
    sessao: Session, utilizador: Utilizador
) -> TotpConfiguracaoResposta:
    """Gera um segredo novo e devolve o URI para a aplicação autenticadora.

    O segredo fica guardado mas o segundo fator só passa a ser exigido depois de
    o utilizador confirmar um código em `ativar_totp`.
    """
    segredo = totp_seguranca.gerar_segredo()
    repositorio.guardar_totp(sessao, utilizador, segredo, ativo=False)
    return TotpConfiguracaoResposta(
        segredo=segredo,
        uri=totp_seguranca.montar_uri(segredo, utilizador.email),
    )


def ativar_totp(
    sessao: Session, utilizador: Utilizador, codigo: str
) -> TotpEstadoResposta:
    """Confirma o código da aplicação e passa a exigir o segundo fator."""
    if not utilizador.totp_secret:
        raise DadosInvalidosError(
            "Comece por configurar a autenticação de dois fatores."
        )

    if not totp_seguranca.verificar_codigo(utilizador.totp_secret, codigo):
        raise DadosInvalidosError("Código inválido. Tente novamente.")

    repositorio.guardar_totp(sessao, utilizador, utilizador.totp_secret, ativo=True)
    return TotpEstadoResposta(totp_ativo=True)


def desativar_totp(
    sessao: Session, utilizador: Utilizador, codigo: str
) -> TotpEstadoResposta:
    """Confirma o código e deixa de exigir o segundo fator."""
    if not utilizador.totp_ativo or not utilizador.totp_secret:
        raise DadosInvalidosError(
            "A autenticação de dois fatores não está ativa."
        )

    if not totp_seguranca.verificar_codigo(utilizador.totp_secret, codigo):
        raise DadosInvalidosError("Código inválido. Tente novamente.")

    repositorio.guardar_totp(sessao, utilizador, None, ativo=False)
    return TotpEstadoResposta(totp_ativo=False)
