"""Endpoints de eleições.

A consulta é para qualquer utilizador autenticado (o eleitor só vê as eleições
em que está habilitado); tudo o que altera dados é só para administradores.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.models.utilizador import Utilizador
from app.schemas.candidato import (
    CandidatoAlterar,
    CandidatoNovo,
    CandidatoResposta,
)
from app.schemas.eleicao import (
    EleicaoAlterar,
    EleicaoCriar,
    EleicaoDetalhe,
    EleicaoResposta,
)
from app.schemas.habilitacao import (
    HabilitacaoLote,
    HabilitacaoLoteResposta,
    HabilitadoResposta,
)
from app.schemas.ronda import RondaDatas, RondaNova, RondaResposta
from app.security.dependencias import exigir_administrador, utilizador_atual
from app.services import candidato as servico_candidato
from app.services import eleicao as servico
from app.services import habilitacao as servico_habilitacao
from app.services import ronda as servico_ronda

eleicao_routers = APIRouter(prefix="/eleicoes", tags=["eleicoes"])

so_administradores = [Depends(exigir_administrador)]


@eleicao_routers.post(
    "", response_model=EleicaoResposta, status_code=status.HTTP_201_CREATED
)
def criar_eleicao(
    dados: EleicaoCriar,
    sessao: Session = Depends(obter_sessao),
    administrador: Utilizador = Depends(exigir_administrador),
):
    """Cria uma eleição em estado 'rascunho', com o criador tirado do token."""
    return servico.criar_eleicao(sessao, dados, criador_id=administrador.id)


@eleicao_routers.get("", response_model=list[EleicaoResposta])
def listar_eleicoes(
    estado: str | None = None,
    sessao: Session = Depends(obter_sessao),
    utilizador: Utilizador = Depends(utilizador_atual),
):
    """Lista as eleições que o utilizador pode ver."""
    return servico.listar_eleicoes(sessao, utilizador, estado=estado)


@eleicao_routers.get("/{eleicao_id}", response_model=EleicaoDetalhe)
def obter_eleicao(
    eleicao_id: int,
    sessao: Session = Depends(obter_sessao),
    utilizador: Utilizador = Depends(utilizador_atual),
):
    """Devolve uma eleição com os candidatos e as rondas."""
    eleicao = servico.obter_eleicao_visivel(sessao, eleicao_id, utilizador)
    return servico.detalhe_eleicao(sessao, eleicao)


@eleicao_routers.patch(
    "/{eleicao_id}", response_model=EleicaoResposta, dependencies=so_administradores
)
def atualizar_eleicao(
    eleicao_id: int, dados: EleicaoAlterar, sessao: Session = Depends(obter_sessao)
):
    """Altera o título ou a descrição antes de a votação começar."""
    return servico.atualizar_eleicao(sessao, eleicao_id, dados)


@eleicao_routers.delete(
    "/{eleicao_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=so_administradores,
)
def apagar_eleicao(eleicao_id: int, sessao: Session = Depends(obter_sessao)):
    """Apaga uma eleição em 'rascunho'."""
    servico.apagar_eleicao(sessao, eleicao_id)


@eleicao_routers.post(
    "/{eleicao_id}/agendar",
    response_model=EleicaoDetalhe,
    dependencies=so_administradores,
)
def agendar_eleicao(eleicao_id: int, sessao: Session = Depends(obter_sessao)):
    """Passa de 'rascunho' a 'agendada', depois de validar o que falta."""
    return servico.detalhe_eleicao(sessao, servico.agendar_eleicao(sessao, eleicao_id))


@eleicao_routers.post(
    "/{eleicao_id}/iniciar",
    response_model=EleicaoDetalhe,
    dependencies=so_administradores,
)
def iniciar_eleicao(eleicao_id: int, sessao: Session = Depends(obter_sessao)):
    """Passa a 'em_curso' e abre a 1.ª volta."""
    return servico.detalhe_eleicao(sessao, servico.iniciar_eleicao(sessao, eleicao_id))


@eleicao_routers.post(
    "/{eleicao_id}/encerrar",
    response_model=EleicaoDetalhe,
    dependencies=so_administradores,
)
def encerrar_eleicao(eleicao_id: int, sessao: Session = Depends(obter_sessao)):
    """Encerra a eleição e todas as voltas ainda abertas."""
    return servico.detalhe_eleicao(sessao, servico.encerrar_eleicao(sessao, eleicao_id))


# ===== Rondas =====
@eleicao_routers.post(
    "/{eleicao_id}/rondas",
    response_model=RondaResposta,
    status_code=status.HTTP_201_CREATED,
    dependencies=so_administradores,
)
def criar_ronda(
    eleicao_id: int, dados: RondaNova, sessao: Session = Depends(obter_sessao)
):
    """Cria a volta seguinte da eleição."""
    return servico_ronda.criar_ronda_na_eleicao(sessao, eleicao_id, dados)


@eleicao_routers.patch(
    "/{eleicao_id}/rondas/{numero}",
    response_model=RondaResposta,
    dependencies=so_administradores,
)
def atualizar_ronda(
    eleicao_id: int,
    numero: int,
    dados: RondaDatas,
    sessao: Session = Depends(obter_sessao),
):
    """Altera as datas de uma volta que ainda não abriu."""
    return servico_ronda.atualizar_ronda(sessao, eleicao_id, numero, dados)


@eleicao_routers.post(
    "/{eleicao_id}/rondas/{numero}/abrir",
    response_model=RondaResposta,
    dependencies=so_administradores,
)
def abrir_ronda(
    eleicao_id: int, numero: int, sessao: Session = Depends(obter_sessao)
):
    """Abre a votação de uma volta."""
    return servico_ronda.abrir_ronda(sessao, eleicao_id, numero)


@eleicao_routers.post(
    "/{eleicao_id}/rondas/{numero}/encerrar",
    response_model=RondaResposta,
    dependencies=so_administradores,
)
def encerrar_ronda(
    eleicao_id: int, numero: int, sessao: Session = Depends(obter_sessao)
):
    """Encerra a votação de uma volta."""
    return servico_ronda.encerrar_ronda(sessao, eleicao_id, numero)


# ===== Candidatos =====
@eleicao_routers.post(
    "/{eleicao_id}/candidatos",
    response_model=CandidatoResposta,
    status_code=status.HTTP_201_CREATED,
    dependencies=so_administradores,
)
def criar_candidato(
    eleicao_id: int, dados: CandidatoNovo, sessao: Session = Depends(obter_sessao)
):
    """Adiciona um candidato à eleição."""
    return servico_candidato.criar_candidato_na_eleicao(sessao, eleicao_id, dados)


@eleicao_routers.patch(
    "/{eleicao_id}/candidatos/{candidato_id}",
    response_model=CandidatoResposta,
    dependencies=so_administradores,
)
def atualizar_candidato(
    eleicao_id: int,
    candidato_id: int,
    dados: CandidatoAlterar,
    sessao: Session = Depends(obter_sessao),
):
    """Altera um candidato antes de a votação começar."""
    return servico_candidato.atualizar_candidato(
        sessao, eleicao_id, candidato_id, dados
    )


@eleicao_routers.delete(
    "/{eleicao_id}/candidatos/{candidato_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=so_administradores,
)
def apagar_candidato(
    eleicao_id: int, candidato_id: int, sessao: Session = Depends(obter_sessao)
):
    """Remove um candidato antes de a votação começar."""
    servico_candidato.apagar_candidato(sessao, eleicao_id, candidato_id)


# ===== Caderno eleitoral =====
@eleicao_routers.get(
    "/{eleicao_id}/habilitados",
    response_model=list[HabilitadoResposta],
    dependencies=so_administradores,
)
def listar_habilitados(eleicao_id: int, sessao: Session = Depends(obter_sessao)):
    """Lista quem pode votar na eleição."""
    return servico_habilitacao.listar_habilitados(sessao, eleicao_id)


@eleicao_routers.post(
    "/{eleicao_id}/habilitados",
    response_model=HabilitacaoLoteResposta,
    dependencies=so_administradores,
)
def habilitar(
    eleicao_id: int, dados: HabilitacaoLote, sessao: Session = Depends(obter_sessao)
):
    """Habilita vários utilizadores de uma vez."""
    return servico_habilitacao.habilitar_lote(sessao, eleicao_id, dados.utilizador_ids)


@eleicao_routers.delete(
    "/{eleicao_id}/habilitados/{utilizador_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    dependencies=so_administradores,
)
def desabilitar(
    eleicao_id: int, utilizador_id: int, sessao: Session = Depends(obter_sessao)
):
    """Retira um utilizador do caderno eleitoral."""
    servico_habilitacao.desabilitar(sessao, eleicao_id, utilizador_id)
