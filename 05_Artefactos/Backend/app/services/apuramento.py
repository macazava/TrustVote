"""Apuramento e resultados (RF09, RF10).

- Uma ronda só é apurada depois de encerrada. O apuramento confirma o HMAC de cada voto
  (votos adulterados não contam e são reportados) e compara o número de votos com o número
  de participações (têm de ser iguais).
- Regras (eleição presidencial): na ronda 1 ganha quem tiver MAIS de 50% dos votos; se ninguém
  tiver, passam os 2 mais votados à 2.ª volta. Na 2.ª volta ganha o mais votado. Empates
  ficam assinalados para decisão do administrador.
- Os resultados só ficam visíveis depois de apurados (não há contagens parciais durante a votação).
"""
from collections import Counter
from datetime import datetime, timezone
from decimal import ROUND_HALF_UP, Decimal

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.models import Eleicao, Habilitacao, Participacao, Resultado, Ronda, Utilizador, Voto
from app.models.eleicao import (ELEICAO_EM_CURSO, ELEICAO_ENCERRADA, RONDA_ABERTA, RONDA_APURADA,
                                RONDA_ENCERRADA)
from app.repositories import eleicao as repo_eleicao
from app.security.integridade import voto_valido
from app.services import auditoria
from app.services import eleicao as servico_eleicao
from app.services.erros import Conflito, NaoEncontrado

def _percentagem(votos: int, total: int) -> Decimal:
    if total == 0:
        return Decimal("0.00")
    return (Decimal(votos) * 100 / Decimal(total)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def apurar_ronda(db: Session, eleicao_id: int, numero: int, *, ator: Utilizador | None = None) -> dict:
    """ator=None quando é o worker automático."""
    eleicao = repo_eleicao.por_id(db, eleicao_id, bloquear=True)
    if eleicao is None:
        raise NaoEncontrado("Eleição não encontrada")
    if eleicao.estado not in (ELEICAO_EM_CURSO, ELEICAO_ENCERRADA):
        raise Conflito(f"A eleição está '{eleicao.estado}'")
    ronda = eleicao.ronda(numero)
    if ronda is None:
        raise NaoEncontrado(f"A eleição não tem ronda {numero}")
    if ronda.estado == RONDA_APURADA:
        raise Conflito("A ronda já foi apurada")
    if ronda.estado != RONDA_ENCERRADA:
        raise Conflito(f"Só uma ronda encerrada pode ser apurada (está '{ronda.estado}')")

    contagem, invalidos = Counter(), 0
    for v in db.scalars(select(Voto).where(Voto.ronda_id == ronda.id)):
        if voto_valido(str(v.id), v.ronda_id, v.candidato_id, v.hash):
            contagem[v.candidato_id] += 1
        else:
            invalidos += 1
    participacoes = db.scalar(select(func.count()).select_from(Participacao).where(Participacao.ronda_id == ronda.id))
    total = sum(contagem.values())

    db.execute(delete(Resultado).where(Resultado.ronda_id == ronda.id))
    for c in ronda.candidatos:
        db.add(Resultado(ronda_id=ronda.id, candidato_id=c.id, total_votos=contagem[c.id],
                         percentagem=_percentagem(contagem[c.id], total)))
    ronda.estado = RONDA_APURADA
    integridade = {"votos_validos": total, "votos_invalidos": invalidos, "participacoes": participacoes,
                   "consistente": invalidos == 0 and total == participacoes}
    auditoria.registar(db, "ronda.apurada", utilizador_id=ator.id if ator else None, entidade="eleicao",
                       entidade_id=eleicao.id, detalhes={"ronda": numero, "automatico": ator is None, **integridade})
    db.commit()
    return {"eleicao_id": eleicao.id, "ronda": numero, **integridade}


def _decisao(numero: int, linhas: list[dict], total: int) -> dict:
    if total == 0:
        return {"tipo": "sem_votos", "candidatos": []}
    primeiro = linhas[0]
    if numero == 1:
        if primeiro["votos"] * 2 > total:
            return {"tipo": "vencedor", "candidatos": [primeiro["candidato_id"]]}
        if len(linhas) > 2 and linhas[1]["votos"] == linhas[2]["votos"]:
            return {"tipo": "empate", "candidatos": [l["candidato_id"] for l in linhas
                                                     if l["votos"] >= linhas[1]["votos"]]}
        return {"tipo": "segunda_volta", "candidatos": [l["candidato_id"] for l in linhas[:2]]}
    if len(linhas) > 1 and linhas[1]["votos"] == primeiro["votos"]:
        return {"tipo": "empate", "candidatos": [l["candidato_id"] for l in linhas if l["votos"] == primeiro["votos"]]}
    return {"tipo": "vencedor", "candidatos": [primeiro["candidato_id"]]}


def _resultado_ronda(db: Session, ronda: Ronda) -> dict:
    base = {"ronda": ronda.numero, "estado": ronda.estado}
    if ronda.estado != RONDA_APURADA:
        return {**base, "apurada": False}
    nomes = {c.id: c for c in ronda.candidatos}
    linhas = sorted(({"candidato_id": r.candidato_id, "nome": nomes[r.candidato_id].nome,
                      "partido": nomes[r.candidato_id].partido, "votos": r.total_votos,
                      "percentagem": r.percentagem}
                     for r in db.scalars(select(Resultado).where(Resultado.ronda_id == ronda.id))),
                    key=lambda l: (-l["votos"], l["candidato_id"]))
    total = sum(l["votos"] for l in linhas)
    return {**base, "apurada": True, "total_votos": total, "candidatos": linhas,
            "decisao": _decisao(ronda.numero, linhas, total)}


def resultados(db: Session, utilizador: Utilizador, eleicao_id: int) -> dict:
    eleicao = servico_eleicao.obter_visivel(db, utilizador, eleicao_id)
    return {"eleicao_id": eleicao.id, "titulo": eleicao.titulo, "estado": eleicao.estado,
            "rondas": [_resultado_ronda(db, r) for r in eleicao.rondas]}


def estatisticas_participacao(db: Session, eleicao_id: int) -> dict:
    """Só para admins: quantos habilitados votaram em cada ronda (sem revelar em quem)."""
    eleicao = repo_eleicao.por_id(db, eleicao_id)
    if eleicao is None:
        raise NaoEncontrado("Eleição não encontrada")
    habilitados = db.scalar(select(func.count()).select_from(Habilitacao).where(Habilitacao.eleicao_id == eleicao.id))
    rondas = []
    for r in eleicao.rondas:
        votantes = db.scalar(select(func.count()).select_from(Participacao).where(Participacao.ronda_id == r.id))
        rondas.append({"ronda": r.numero, "estado": r.estado, "votantes": votantes,
                       "taxa_participacao": _percentagem(votantes, habilitados)})
    return {"eleicao_id": eleicao.id, "habilitados": habilitados, "rondas": rondas}


def ciclo_automatico(db: Session, agora: datetime | None = None) -> dict:
    """Executado pelo worker: encerra as rondas cujo período terminou e apura as encerradas.

    Cada ação bloqueia a sua eleição (FOR UPDATE) e volta a confirmar o estado antes de mudar,
    por isso é seguro haver mais do que um worker, ou um admin a fazer o mesmo pela API.
    """
    agora = agora or datetime.now(timezone.utc)
    expiradas = db.execute(select(Ronda.eleicao_id, Ronda.numero).join(Eleicao)
                           .where(Ronda.estado == RONDA_ABERTA, Ronda.data_fim <= agora,
                                  Eleicao.estado == ELEICAO_EM_CURSO)).all()
    db.commit()
    encerradas, apuradas = [], []
    for eleicao_id, numero in expiradas:
        db.expire_all()  # sessão longa (worker): ler sempre o estado atual da BD
        eleicao = repo_eleicao.por_id(db, eleicao_id, bloquear=True)
        ronda = eleicao.ronda(numero)
        if eleicao.estado == ELEICAO_EM_CURSO and ronda.estado == RONDA_ABERTA and ronda.data_fim <= agora:
            ronda.estado = RONDA_ENCERRADA
            auditoria.registar(db, "ronda.encerrada", entidade="eleicao", entidade_id=eleicao_id,
                               detalhes={"ronda": numero, "automatico": True})
            encerradas.append((eleicao_id, numero))
        db.commit()
    por_apurar = db.execute(select(Ronda.eleicao_id, Ronda.numero).join(Eleicao)
                            .where(Ronda.estado == RONDA_ENCERRADA,
                                   Eleicao.estado.in_((ELEICAO_EM_CURSO, ELEICAO_ENCERRADA)))).all()
    db.commit()
    for eleicao_id, numero in por_apurar:
        db.expire_all()
        try:
            apuradas.append(apurar_ronda(db, eleicao_id, numero))
        except (Conflito, NaoEncontrado):
            db.rollback()  # outro processo apurou entretanto
    return {"executado": True, "encerradas": encerradas, "apuradas": apuradas}
