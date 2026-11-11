"""Acesso às tabelas da sondagem."""

from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models.sondagem import SondagemParticipacao, SondagemResposta


class RespostaRepetidaError(Exception):
    """Este utilizador já respondeu à sondagem desta eleição."""


def responder(sessao: Session, eleicao_id: int, utilizador_id: int, candidato_id: int) -> None:
    """Grava quem respondeu e a resposta na mesma transação, em tabelas separadas."""
    sessao.add(SondagemParticipacao(eleicao_id=eleicao_id, utilizador_id=utilizador_id))
    try:
        sessao.flush()
    except IntegrityError as erro:
        sessao.rollback()
        raise RespostaRepetidaError from erro
    sessao.add(SondagemResposta(eleicao_id=eleicao_id, candidato_id=candidato_id))
    sessao.commit()


def ja_respondeu(sessao: Session, eleicao_id: int, utilizador_id: int) -> bool:
    return sessao.get(SondagemParticipacao, (eleicao_id, utilizador_id)) is not None


def contar_respostas(sessao: Session, eleicao_id: int) -> dict[int, int]:
    linhas = sessao.execute(
        select(SondagemResposta.candidato_id, func.count())
        .where(SondagemResposta.eleicao_id == eleicao_id)
        .group_by(SondagemResposta.candidato_id)
    )
    return {candidato_id: total for candidato_id, total in linhas}
