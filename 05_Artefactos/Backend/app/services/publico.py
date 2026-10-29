"""Resumo público (sem login): usado pela página inicial, calendário, listas e resultados públicos.

Só mostra o que já é público numa eleição: título, datas, candidatos, número de eleitores
habilitados e quantos já votaram. Nunca mostra contagens por candidato nem quem votou.
"""
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Eleicao, Habilitacao, Participacao
from app.models.eleicao import ELEICAO_AGENDADA, ELEICAO_EM_CURSO, ELEICAO_ENCERRADA
from app.services.apuramento import _percentagem


def _eleicao_em_destaque(db: Session) -> Eleicao | None:
    """A eleição em curso; senão a próxima agendada; senão a última encerrada."""
    for estado in (ELEICAO_EM_CURSO, ELEICAO_AGENDADA, ELEICAO_ENCERRADA):
        eleicao = db.scalar(select(Eleicao).where(Eleicao.estado == estado).order_by(Eleicao.id.desc()).limit(1))
        if eleicao is not None:
            return eleicao
    return None


def resumo(db: Session) -> dict:
    eleicao = _eleicao_em_destaque(db)
    if eleicao is None:
        return {"eleicao": None, "eleitores": 0, "votos": 0, "participacao": 0.0, "candidatos": []}
    ronda = eleicao.ronda_atual()
    eleitores = db.scalar(select(func.count()).select_from(Habilitacao).where(Habilitacao.eleicao_id == eleicao.id))
    votos = db.scalar(select(func.count()).select_from(Participacao)
                      .where(Participacao.ronda_id == ronda.id)) if ronda else 0
    candidatos = ronda.candidatos if ronda and ronda.candidatos else [c for c in eleicao.candidatos if c.ativo]
    return {
        "eleicao": {"id": eleicao.id, "titulo": eleicao.titulo, "estado": eleicao.estado,
                    "data_inicio": ronda.data_inicio if ronda else None,
                    "data_fim": ronda.data_fim if ronda else None},
        "eleitores": eleitores,
        "votos": votos,
        "participacao": float(_percentagem(votos, eleitores)),
        "candidatos": [{"id": c.id, "nome": c.nome, "partido": c.partido, "descricao": c.descricao}
                       for c in candidatos],
    }
