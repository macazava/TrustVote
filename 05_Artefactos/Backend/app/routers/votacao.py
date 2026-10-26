import uuid

from fastapi import APIRouter, Query, Request, status

from app.routers.autenticacao import ip_cliente
from app.schemas.votacao import (ApuramentoOut, AuditoriaOut, EstatisticasOut, ParticipacaoRondaOut, ReciboOut,
                                 ResultadosOut, VerificacaoAuditoriaOut, VerificacaoReciboOut, VotoIn)
from app.security.dependencias import Admin, DbSession, UtilizadorAtual
from app.services import apuramento, auditoria, votacao
from app.services.erros import Proibido

router = APIRouter(tags=["votação e resultados"])
router_auditoria = APIRouter(prefix="/auditoria", tags=["auditoria (admin)"])


# ------------------------------------------------------------ votação (eleitores)

@router.post("/eleicoes/{eleicao_id}/rondas/{numero}/votos", response_model=ReciboOut,
             status_code=status.HTTP_201_CREATED)
def votar(eleicao_id: int, numero: int, dados: VotoIn, utilizador: UtilizadorAtual, db: DbSession,
          request: Request):
    """Submete o voto do eleitor autenticado nesta ronda (um por ronda)."""
    if utilizador.is_admin:
        raise Proibido("Administradores não votam")
    voto_id, ronda = votacao.votar(db, utilizador, eleicao_id, numero, dados.candidato_id, ip=ip_cliente(request))
    return ReciboOut(recibo=voto_id, eleicao_id=eleicao_id, ronda=ronda.numero)


@router.get("/eleicoes/{eleicao_id}/minha-participacao", response_model=list[ParticipacaoRondaOut])
def minha_participacao(eleicao_id: int, utilizador: UtilizadorAtual, db: DbSession):
    """Em que rondas desta eleição o eleitor já votou."""
    return votacao.minha_participacao(db, utilizador, eleicao_id)


@router.get("/votos/{recibo}", response_model=VerificacaoReciboOut)
def verificar_recibo(recibo: uuid.UUID, _: UtilizadorAtual, db: DbSession):
    """Confirma que o voto com este recibo foi registado e não foi alterado (não mostra o candidato)."""
    return votacao.verificar_recibo(db, recibo)


# ------------------------------------------------------------ apuramento e resultados

@router.post("/eleicoes/{eleicao_id}/rondas/{numero}/apurar", response_model=ApuramentoOut)
def apurar(eleicao_id: int, numero: int, admin: Admin, db: DbSession):
    """Conta os votos de uma ronda encerrada (o worker também o faz automaticamente)."""
    return apuramento.apurar_ronda(db, eleicao_id, numero, ator=admin)


@router.get("/eleicoes/{eleicao_id}/resultados", response_model=ResultadosOut)
def resultados(eleicao_id: int, utilizador: UtilizadorAtual, db: DbSession):
    """Resultados das rondas já apuradas (mesmas regras de visibilidade que a eleição)."""
    return apuramento.resultados(db, utilizador, eleicao_id)


@router.get("/eleicoes/{eleicao_id}/estatisticas", response_model=EstatisticasOut)
def estatisticas(eleicao_id: int, _: Admin, db: DbSession):
    """Participação por ronda (quantos votaram), sem revelar em quem."""
    return apuramento.estatisticas_participacao(db, eleicao_id)


# ------------------------------------------------------------ auditoria (admin)

@router_auditoria.get("", response_model=list[AuditoriaOut])
def listar_auditoria(_: Admin, db: DbSession, acao: str | None = None, utilizador_id: int | None = None,
                     entidade: str | None = None, entidade_id: int | None = None,
                     limite: int = Query(100, ge=1, le=1000), antes_de: int | None = None):
    """Registos mais recentes primeiro. `acao` aceita * (ex.: `auth.*`). Paginação com `antes_de`."""
    return auditoria.listar(db, acao=acao, utilizador_id=utilizador_id, entidade=entidade,
                            entidade_id=entidade_id, limite=limite, antes_de=antes_de)


@router_auditoria.get("/verificar", response_model=VerificacaoAuditoriaOut)
def verificar_auditoria(_: Admin, db: DbSession):
    """Recalcula a cadeia de hashes e indica o primeiro registo adulterado, se existir."""
    return auditoria.verificar_cadeia(db)
