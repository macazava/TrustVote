import uuid

from fastapi import APIRouter, Query, Request, status

from app.routers.autenticacao import ip_cliente
from app.schemas.votacao import (ApuramentoOut, AuditoriaOut, EstatisticasOut, ParticipacaoOut,
                                 ParticipacaoRondaOut, ReciboOut, ResultadoRondaOut, ResumoPublicoOut,
                                 SondagemOut, SondagemRespostaIn, SondagemRespostaOut, VerificacaoAuditoriaOut,
                                 VerificacaoReciboFrontOut, VerificacaoReciboOut, VotoIn)
from app.security.dependencias import Admin, DbLeitura, DbSession, UtilizadorAtual
from app.services import apuramento, auditoria, publico, sondagem, votacao
from app.services.erros import Proibido

router = APIRouter(tags=["votação e resultados"])
router_auditoria = APIRouter(prefix="/auditoria", tags=["auditoria (admin)"])
router_publico = APIRouter(prefix="/publico", tags=["público (sem login)"])


# ------------------------------------------------------------ votação (eleitores)

@router.post("/eleicoes/{eleicao_id}/rondas/{numero}/votos", response_model=ReciboOut,
             status_code=status.HTTP_201_CREATED)
def votar(eleicao_id: int, numero: int, dados: VotoIn, utilizador: UtilizadorAtual, db: DbSession,
          request: Request):
    """Submete o voto do eleitor autenticado nesta ronda (um por ronda)."""
    if utilizador.is_admin:
        raise Proibido("Administradores não votam")
    return votacao.votar(db, utilizador, eleicao_id, numero, dados.candidato_id, ip=ip_cliente(request))


@router.get("/eleicoes/{eleicao_id}/participacao", response_model=ParticipacaoOut)
def participacao(eleicao_id: int, utilizador: UtilizadorAtual, db: DbSession):
    """votou = já votou na ronda atual da eleição (usado pelo frontend)."""
    return votacao.participacao(db, utilizador, eleicao_id)


@router.get("/eleicoes/{eleicao_id}/minha-participacao", response_model=list[ParticipacaoRondaOut])
def minha_participacao(eleicao_id: int, utilizador: UtilizadorAtual, db: DbSession):
    """Em que rondas desta eleição o eleitor já votou."""
    return votacao.minha_participacao(db, utilizador, eleicao_id)


@router.get("/votos/{recibo}", response_model=VerificacaoReciboOut)
def verificar_recibo(recibo: uuid.UUID, _: UtilizadorAtual, db: DbSession):
    """Confirma que o voto com este recibo foi registado e não foi alterado (não mostra o candidato)."""
    return votacao.verificar_recibo(db, recibo)


@router.get("/recibos/{codigo}/verificar", response_model=VerificacaoReciboFrontOut)
def verificar_codigo(codigo: str, _: UtilizadorAtual, db: DbSession):
    """O mesmo que /votos/{recibo}, no formato do frontend (valido / incluido).

    Não existe GET /recibos (lista): o backend não guarda que recibo pertence a que eleitor,
    senão o voto deixava de ser anónimo. O frontend guarda os recibos no próprio dispositivo."""
    return votacao.verificar_codigo(db, codigo)


# ------------------------------------------------------------ apuramento e resultados

@router.post("/eleicoes/{eleicao_id}/rondas/{numero}/apurar", response_model=ApuramentoOut)
def apurar(eleicao_id: int, numero: int, admin: Admin, db: DbSession):
    """Conta os votos de uma ronda encerrada (o worker também o faz automaticamente)."""
    return apuramento.apurar_ronda(db, eleicao_id, numero, ator=admin)


@router.get("/eleicoes/{eleicao_id}/resultados", response_model=list[ResultadoRondaOut])
def resultados(eleicao_id: int, utilizador: UtilizadorAtual, db: DbSession):
    """Uma entrada por ronda: apuradas para todos; provisórias (abertas/encerradas) só para admins."""
    return apuramento.resultados(db, utilizador, eleicao_id)


@router.get("/eleicoes/{eleicao_id}/estatisticas", response_model=EstatisticasOut)
def estatisticas(eleicao_id: int, _: Admin, db: DbLeitura):
    """Participação (quantos votaram, por ronda e por hora), sem revelar em quem."""
    return apuramento.estatisticas_participacao(db, eleicao_id)


# ------------------------------------------------------------ sondagem (simulação, não é o voto)

@router.get("/eleicoes/{eleicao_id}/sondagem", response_model=SondagemOut)
def obter_sondagem(eleicao_id: int, utilizador: UtilizadorAtual, db: DbSession):
    return sondagem.obter(db, utilizador, eleicao_id)


@router.post("/eleicoes/{eleicao_id}/sondagem/respostas", response_model=SondagemRespostaOut,
             status_code=status.HTTP_201_CREATED)
def responder_sondagem(eleicao_id: int, dados: SondagemRespostaIn, utilizador: UtilizadorAtual, db: DbSession):
    """Uma resposta anónima por pessoa e por eleição."""
    return sondagem.responder(db, utilizador, eleicao_id, dados.candidato_id)


# ------------------------------------------------------------ público (sem login)

@router_publico.get("/resumo", response_model=ResumoPublicoOut)
def resumo_publico(db: DbLeitura):
    """Eleição em destaque (em curso > agendada > última encerrada), candidatos e participação."""
    return publico.resumo(db)


# ------------------------------------------------------------ auditoria (admin)

@router_auditoria.get("", response_model=list[AuditoriaOut])
def listar_auditoria(_: Admin, db: DbLeitura, acao: str | None = None, utilizador_id: int | None = None,
                     entidade: str | None = None, entidade_id: int | None = None,
                     limite: int = Query(100, ge=1, le=1000), antes_de: int | None = None):
    """Registos mais recentes primeiro. `acao` aceita * (ex.: `auth.*`). Paginação com `antes_de`."""
    return auditoria.listar(db, acao=acao, utilizador_id=utilizador_id, entidade=entidade,
                            entidade_id=entidade_id, limite=limite, antes_de=antes_de)


@router_auditoria.get("/verificar", response_model=VerificacaoAuditoriaOut)
def verificar_auditoria(_: Admin, db: DbLeitura):
    """Recalcula a cadeia de hashes e indica o primeiro registo adulterado, se existir."""
    return auditoria.verificar_cadeia(db)
