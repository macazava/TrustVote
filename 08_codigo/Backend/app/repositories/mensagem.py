"""Acesso às mensagens do formulário de contacto (tabela `mensagem_contacto`)."""

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.mensagem import MensagemContacto


def criar(sessao: Session, mensagem: MensagemContacto) -> MensagemContacto:
    sessao.add(mensagem)
    sessao.commit()
    sessao.refresh(mensagem)
    return mensagem


def listar(sessao: Session, limite: int = 500) -> list[MensagemContacto]:
    return list(
        sessao.scalars(
            select(MensagemContacto).order_by(MensagemContacto.data.desc()).limit(limite)
        )
    )


def obter(sessao: Session, mensagem_id: int) -> MensagemContacto | None:
    return sessao.get(MensagemContacto, mensagem_id)


def guardar(sessao: Session) -> None:
    sessao.commit()
