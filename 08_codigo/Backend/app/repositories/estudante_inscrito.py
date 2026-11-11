"""Acesso à lista oficial de estudantes (tabela `estudante_inscrito`)."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.estudante_inscrito import EstudanteInscrito


def obter(sessao: Session, num_estudante: str) -> EstudanteInscrito | None:
    return sessao.get(EstudanteInscrito, num_estudante)


def listar(sessao: Session, limite: int = 5000) -> list[EstudanteInscrito]:
    return list(
        sessao.scalars(
            select(EstudanteInscrito).order_by(EstudanteInscrito.num_estudante).limit(limite)
        )
    )


def contar(sessao: Session) -> int:
    return sessao.scalar(select(func.count()).select_from(EstudanteInscrito))


def adicionar(sessao: Session, estudantes: list[EstudanteInscrito]) -> None:
    sessao.add_all(estudantes)
    sessao.commit()
