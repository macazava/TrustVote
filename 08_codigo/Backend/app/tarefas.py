"""Tarefas automáticas, corridas em segundo plano por cada instância da API.

A cada TAREFAS_INTERVALO segundos (0 desliga, na API):

1. inicia as eleições agendadas cuja 1.ª volta já começou;
2. abre a 2.ª volta quando chega a hora de início;
3. encerra e apura as voltas cujo fim já passou. Ao fechar a 2.ª volta, a
   eleição fica encerrada; depois da 1.ª, a equipa decide se há 2.ª volta;
4. apura as voltas encerradas que ficaram à espera do worker.

Com várias instâncias, um advisory lock garante que só uma corre o ciclo de
cada vez. Tudo fica na auditoria como ação do "Sistema".
"""

import asyncio
import logging
import os
from datetime import datetime, timezone

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.database import engine
from app.erros import EstadoInvalidoError
from app.repositories import eleicao as repositorio_eleicao
from app.repositories import ronda as repositorio_ronda
from app.services import eleicao as servico_eleicao
from app.services import ronda as servico_ronda
from app.services.apuramento import apurar_ronda
from app.services.auditoria import Auditor

log = logging.getLogger("trustvote.tarefas")

INTERVALO = int(os.getenv("TAREFAS_INTERVALO", "30"))
_CHAVE = 7_240_012


def _iniciar_agendadas(sessao: Session, agora: datetime, auditar: Auditor) -> None:
    for eleicao in repositorio_eleicao.listar(sessao, estado="agendada"):
        primeira = repositorio_ronda.obter_por_eleicao_e_numero(sessao, eleicao.id, 1)
        if primeira is None or primeira.data_inicio > agora:
            continue
        try:
            servico_eleicao.iniciar_eleicao(sessao, eleicao.id)
        except EstadoInvalidoError as erro:
            # Ex.: a equipa retirou candidatos depois de agendar. Fica à espera.
            sessao.rollback()
            log.warning("Eleição %s não iniciou: %s", eleicao.id, erro)
            continue
        auditar("Votação iniciada automaticamente", "eleicao", eleicao.id)


def _abrir_voltas(sessao: Session, agora: datetime, auditar: Auditor) -> None:
    for ronda in repositorio_ronda.listar_agendadas_a_abrir(sessao, agora):
        eleicao = repositorio_eleicao.obter_por_id(sessao, ronda.eleicao_id)
        # A 1.ª volta abre com a eleição (passo anterior); aqui só a 2.ª.
        if eleicao.estado != "em_curso" or ronda.numero == 1:
            continue
        try:
            servico_ronda.abrir_ronda(sessao, ronda.eleicao_id, ronda.numero)
        except EstadoInvalidoError:
            sessao.rollback()
            continue
        auditar("Volta aberta automaticamente", "ronda", ronda.id, eleicao_id=eleicao.id)


def _fechar_expiradas(sessao: Session, agora: datetime, auditar: Auditor) -> None:
    for expirada in repositorio_ronda.listar_abertas_expiradas(sessao, agora):
        eleicao_id, numero = expirada.eleicao_id, expirada.numero
        # Bloqueia e relê: espera pelos votos em curso e confirma que ninguém a fechou entretanto.
        ronda = repositorio_ronda.obter_por_eleicao_e_numero(
            sessao, eleicao_id, numero, bloqueio="exclusivo"
        )
        if ronda.estado != "aberta":
            sessao.rollback()
            continue
        contagem = servico_ronda.fechar_e_apurar(sessao, ronda)
        auditar(
            "Volta encerrada e apurada automaticamente",
            "ronda",
            ronda.id,
            eleicao_id=eleicao_id,
            numero=numero,
            votos_invalidos=contagem.invalidos,
        )
        if numero == 2:
            try:
                servico_eleicao.encerrar_eleicao(sessao, eleicao_id)
            except EstadoInvalidoError:
                sessao.rollback()
                continue
            auditar("Eleição encerrada automaticamente", "eleicao", eleicao_id)


def apurar_pendentes(sessao: Session, ronda_ids: list[int] | None = None) -> int:
    """Apura as voltas encerradas que esperam pelo worker (todas, ou só as indicadas)."""
    auditar = Auditor(sessao, None, None)
    if ronda_ids is None:
        ronda_ids = [r.id for r in repositorio_ronda.listar_encerradas_por_apurar(sessao)]
        sessao.rollback()
    apuradas = 0
    for ronda_id in ronda_ids:
        # Bloqueia e relê: outro worker (ou a API) pode tê-la apurado entretanto.
        ronda = repositorio_ronda.bloquear_por_id(sessao, ronda_id)
        if ronda is None or ronda.estado != "encerrada":
            sessao.rollback()
            continue
        contagem = apurar_ronda(sessao, ronda)
        sessao.commit()
        auditar(
            "Volta apurada",
            "ronda",
            ronda.id,
            eleicao_id=ronda.eleicao_id,
            numero=ronda.numero,
            votos_invalidos=contagem.invalidos,
        )
        apuradas += 1
    return apuradas


def executar_tarefas(sessao: Session, agora: datetime | None = None) -> None:
    """Um ciclo das tarefas, na sessão indicada (os testes chamam diretamente)."""
    agora = agora or datetime.now(timezone.utc)
    auditar = Auditor(sessao, None, None)
    _iniciar_agendadas(sessao, agora, auditar)
    _abrir_voltas(sessao, agora, auditar)
    _fechar_expiradas(sessao, agora, auditar)
    apurar_pendentes(sessao)


def executar_ciclo() -> None:
    """Corre um ciclo, se nenhuma outra instância estiver a correr o seu."""
    with engine.connect() as conexao:
        if not conexao.scalar(text("SELECT pg_try_advisory_lock(:k)"), {"k": _CHAVE}):
            conexao.rollback()
            return
        conexao.commit()
        try:
            # Ligada à mesma conexão: o lock (de sessão) dura até ao unlock, mesmo entre commits.
            with Session(bind=conexao, autoflush=False) as sessao:
                executar_tarefas(sessao)
        finally:
            conexao.rollback()
            conexao.execute(text("SELECT pg_advisory_unlock(:k)"), {"k": _CHAVE})
            conexao.commit()


async def correr_para_sempre() -> None:
    """Ciclo em segundo plano, arrancado no lifespan da aplicação."""
    while True:
        await asyncio.sleep(INTERVALO)
        try:
            await asyncio.to_thread(executar_ciclo)
        except SQLAlchemyError as erro:
            # Ex.: durante um failover. O próximo ciclo tenta outra vez.
            log.warning("Tarefas automáticas adiadas: %s", erro)
        except Exception:
            log.exception("Erro nas tarefas automáticas.")
