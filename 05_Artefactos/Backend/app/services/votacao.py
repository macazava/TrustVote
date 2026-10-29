"""Votação (RF06, RF07, RF08).

Um voto só é aceite se, no mesmo instante:
  - a eleição está em_curso e o eleitor está habilitado nela;
  - a ronda está aberta e a hora atual está entre data_inicio e data_fim (RF08);
  - o candidato concorre nessa ronda (ronda_candidato);
  - o eleitor ainda não votou nessa ronda (RF07).

Participação (quem votou) e voto (em quem) são gravados na MESMA transação: ou ficam os dois,
ou nenhum. O UNIQUE (ronda, utilizador) da tabela participacao garante que não há voto duplicado,
mesmo com dois pedidos simultâneos em instâncias diferentes. A eleição é lida com FOR SHARE: o
admin/worker não consegue encerrar a ronda a meio de um voto (espera que ele termine).
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Eleicao, Participacao, Ronda, Utilizador, Voto
from app.models.eleicao import ELEICAO_EM_CURSO, RONDA_ABERTA
from app.repositories import eleicao as repo_eleicao
from app.security.integridade import hash_voto, voto_valido
from app.services import auditoria
from app.services import eleicao as servico_eleicao
from app.services.erros import Conflito, DadosInvalidos, NaoEncontrado


def votar(db: Session, eleitor: Utilizador, eleicao_id: int, numero_ronda: int, candidato_id: int,
          *, ip: str | None = None, agora: datetime | None = None) -> dict:
    """Devolve o recibo: {recibo, hash, data, eleicao_id, ronda}."""
    agora = agora or datetime.now(timezone.utc)
    eleicao = db.scalar(select(Eleicao).where(Eleicao.id == eleicao_id).with_for_update(read=True))
    if eleicao is None or not repo_eleicao.esta_habilitado(db, eleicao_id, eleitor.id):
        raise NaoEncontrado("Eleição não encontrada")
    if eleicao.estado != ELEICAO_EM_CURSO:
        raise Conflito(f"A eleição não está a decorrer (estado '{eleicao.estado}')")
    ronda = eleicao.ronda(numero_ronda)
    if ronda is None:
        raise NaoEncontrado(f"A eleição não tem ronda {numero_ronda}")
    if ronda.estado != RONDA_ABERTA:
        raise Conflito(f"A ronda {numero_ronda} não está aberta (estado '{ronda.estado}')")
    if not (ronda.data_inicio <= agora <= ronda.data_fim):
        raise Conflito("Fora do período de votação da ronda")
    if candidato_id not in {c.id for c in ronda.candidatos}:
        raise DadosInvalidos("Esse candidato não concorre nesta ronda")

    db.add(Participacao(ronda_id=ronda.id, utilizador_id=eleitor.id))
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise Conflito("Já votou nesta ronda")

    voto_id = uuid.uuid4()
    hash_ = hash_voto(str(voto_id), ronda.id, candidato_id)
    db.add(Voto(id=voto_id, ronda_id=ronda.id, candidato_id=candidato_id, hash=hash_))
    # a auditoria regista QUE votou (já visível em participacao), nunca o candidato
    auditoria.registar(db, "voto.registado", utilizador_id=eleitor.id, entidade="ronda", entidade_id=ronda.id,
                       detalhes={"eleicao": eleicao.id, "ronda": ronda.numero}, ip=ip)
    db.commit()
    return {"recibo": voto_id, "hash": hash_, "data": agora, "eleicao_id": eleicao.id, "ronda": ronda.numero}


def minha_participacao(db: Session, eleitor: Utilizador, eleicao_id: int) -> list[dict]:
    eleicao = servico_eleicao.obter_visivel(db, eleitor, eleicao_id)
    votou = {p.ronda_id: p.data for p in db.scalars(
        select(Participacao).where(Participacao.utilizador_id == eleitor.id,
                                   Participacao.ronda_id.in_([r.id for r in eleicao.rondas])))}
    return [{"ronda": r.numero, "estado": r.estado, "votou": r.id in votou, "data": votou.get(r.id)}
            for r in eleicao.rondas]


def participacao(db: Session, eleitor: Utilizador, eleicao_id: int) -> dict:
    """Se o eleitor já votou na ronda atual (é o que o frontend usa para mostrar "Já votou")."""
    rondas = minha_participacao(db, eleitor, eleicao_id)
    atual = servico_eleicao.obter_visivel(db, eleitor, eleicao_id).ronda_atual()
    votou = atual is not None and any(r["ronda"] == atual.numero and r["votou"] for r in rondas)
    return {"votou": votou, "ronda": atual.numero if atual else None, "rondas": rondas}


def verificar_codigo(db: Session, codigo: str) -> dict:
    """Verificação pelo código do recibo em texto (um código que não é UUID simplesmente não existe)."""
    try:
        voto_id = uuid.UUID(codigo.strip())
    except ValueError:
        resposta = {"registado": False, "integro": None, "eleicao_id": None, "ronda": None}
    else:
        resposta = verificar_recibo(db, voto_id)
    valido = bool(resposta["registado"] and resposta["integro"])
    return {**resposta, "valido": valido, "incluido": valido}


def verificar_recibo(db: Session, voto_id: uuid.UUID) -> dict:
    """O eleitor confirma que o seu voto foi registado e não foi alterado, sem revelar o candidato."""
    voto = db.get(Voto, voto_id)
    if voto is None:
        return {"registado": False, "integro": None, "eleicao_id": None, "ronda": None}
    ronda = db.get(Ronda, voto.ronda_id)
    return {"registado": True, "integro": voto_valido(str(voto.id), voto.ronda_id, voto.candidato_id, voto.hash),
            "eleicao_id": ronda.eleicao_id, "ronda": ronda.numero}
