"""Acesso à tabela de utilizadores."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.utilizador import Utilizador


def obter_por_nome_utilizador(sessao: Session, nome_utilizador: str) -> Utilizador | None:
    return sessao.scalar(
        select(Utilizador).where(Utilizador.nome_utilizador == nome_utilizador)
    )


def obter_por_email(sessao: Session, email: str) -> Utilizador | None:
    return sessao.scalar(select(Utilizador).where(Utilizador.email == email))


def criar(
    sessao: Session, nome_utilizador: str, email: str, password_hash: str
) -> Utilizador:
    utilizador = Utilizador(
        nome_utilizador=nome_utilizador,
        email=email,
        password_hash=password_hash,
    )
    sessao.add(utilizador)
    sessao.commit()
    sessao.refresh(utilizador)
    return utilizador
