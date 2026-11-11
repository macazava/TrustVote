"""Endpoints de eleições.

A consulta é para qualquer utilizador autenticado (o eleitor só vê as eleições
em que está habilitado); tudo o que altera dados é só para administradores e
fica registado na auditoria.
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
from app.security.dependencias import (
    auditor_administrador,
    exigir_administrador,
    utilizador_atual,
)
from app.services import candidato as servico_candidato
from app.services import eleicao as servico
from app.services import habilitacao as servico_habilitacao
from app.services import ronda as servico_ronda
from app.services.auditoria import Auditor

eleicao_routers = APIRouter(prefix="/eleicoes", tags=["eleicoes"])

so_administradores = [Depends(exigir_administrador)]


@eleicao_routers.post(
    "", response_model=EleicaoResposta, status_code=status.HTTP_201_CREATED
)
def criar_eleicao(
    dados: EleicaoCriar,
    sessao: Session = Depends(obter_sessao),
    administrador: Utilizador = Depends(exigir_administrador),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Cria uma eleição em estado 'rascunho', com o criador tirado do token."""
    eleicao = servico.criar_eleicao(sessao, dados, criador_id=administrador.id)
    auditar("Eleição criada", "eleicao", eleicao.id, titulo=eleicao.titulo)
    return eleicao


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


@eleicao_routers.patch("/{eleicao_id}", response_model=EleicaoResposta)
def atualizar_eleicao(
    eleicao_id: int,
    dados: EleicaoAlterar,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Altera o título, a descrição ou o quórum antes de a votação começar."""
    eleicao = servico.atualizar_eleicao(sessao, eleicao_id, dados)
    auditar("Eleição alterada", "eleicao", eleicao.id, **dados.model_dump(exclude_unset=True))
    return eleicao


@eleicao_routers.delete("/{eleicao_id}", status_code=status.HTTP_204_NO_CONTENT)
def apagar_eleicao(
    eleicao_id: int,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Apaga uma eleição em 'rascunho'."""
    servico.apagar_eleicao(sessao, eleicao_id)
    auditar("Eleição apagada", "eleicao", eleicao_id)


@eleicao_routers.post("/{eleicao_id}/agendar", response_model=EleicaoDetalhe)
def agendar_eleicao(
    eleicao_id: int,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Passa de 'rascunho' a 'agendada', depois de validar o que falta."""
    eleicao = servico.agendar_eleicao(sessao, eleicao_id)
    auditar("Eleição agendada", "eleicao", eleicao.id)
    return servico.detalhe_eleicao(sessao, eleicao)


@eleicao_routers.post("/{eleicao_id}/iniciar", response_model=EleicaoDetalhe)
def iniciar_eleicao(
    eleicao_id: int,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Passa a 'em_curso' e abre a 1.ª volta."""
    eleicao = servico.iniciar_eleicao(sessao, eleicao_id)
    auditar("Votação iniciada", "eleicao", eleicao.id)
    return servico.detalhe_eleicao(sessao, eleicao)


@eleicao_routers.post("/{eleicao_id}/encerrar", response_model=EleicaoDetalhe)
def encerrar_eleicao(
    eleicao_id: int,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Encerra a eleição e apura (ou pede ao worker que apure) as voltas ainda abertas."""
    eleicao, invalidos = servico.encerrar_eleicao(sessao, eleicao_id)
    if invalidos is None:
        auditar("Eleição encerrada", "eleicao", eleicao.id)
    else:
        auditar("Eleição encerrada e apurada", "eleicao", eleicao.id, votos_invalidos=invalidos)
    return servico.detalhe_eleicao(sessao, eleicao)


# ===== Rondas =====
@eleicao_routers.post(
    "/{eleicao_id}/rondas",
    response_model=RondaResposta,
    status_code=status.HTTP_201_CREATED,
)
def criar_ronda(
    eleicao_id: int,
    dados: RondaNova,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Cria a volta seguinte da eleição."""
    ronda = servico_ronda.criar_ronda_na_eleicao(sessao, eleicao_id, dados)
    auditar("Volta criada", "ronda", ronda.id, eleicao_id=eleicao_id, numero=ronda.numero)
    return ronda


@eleicao_routers.patch("/{eleicao_id}/rondas/{numero}", response_model=RondaResposta)
def atualizar_ronda(
    eleicao_id: int,
    numero: int,
    dados: RondaDatas,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Altera as datas de uma volta que ainda não abriu."""
    ronda = servico_ronda.atualizar_ronda(sessao, eleicao_id, numero, dados)
    auditar(
        "Datas da volta alteradas",
        "ronda",
        ronda.id,
        eleicao_id=eleicao_id,
        inicio=ronda.data_inicio,
        fim=ronda.data_fim,
    )
    return ronda


@eleicao_routers.post(
    "/{eleicao_id}/rondas/{numero}/abrir", response_model=RondaResposta
)
def abrir_ronda(
    eleicao_id: int,
    numero: int,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Abre a votação de uma volta."""
    ronda = servico_ronda.abrir_ronda(sessao, eleicao_id, numero)
    auditar("Volta aberta", "ronda", ronda.id, eleicao_id=eleicao_id, numero=numero)
    return ronda


@eleicao_routers.post(
    "/{eleicao_id}/rondas/{numero}/encerrar", response_model=RondaResposta
)
def encerrar_ronda(
    eleicao_id: int,
    numero: int,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Encerra a votação de uma volta e guarda o apuramento (ou pede-o ao worker)."""
    ronda, contagem = servico_ronda.encerrar_ronda(sessao, eleicao_id, numero)
    if contagem is None:
        auditar("Volta encerrada", "ronda", ronda.id, eleicao_id=eleicao_id, numero=numero)
    else:
        auditar(
            "Volta encerrada e apurada",
            "ronda",
            ronda.id,
            eleicao_id=eleicao_id,
            numero=numero,
            votos_invalidos=contagem.invalidos,
        )
    return ronda


# ===== Candidatos =====
@eleicao_routers.post(
    "/{eleicao_id}/candidatos",
    response_model=CandidatoResposta,
    status_code=status.HTTP_201_CREATED,
)
def criar_candidato(
    eleicao_id: int,
    dados: CandidatoNovo,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Adiciona um candidato à eleição."""
    candidato = servico_candidato.criar_candidato_na_eleicao(sessao, eleicao_id, dados)
    auditar("Candidato adicionado", "candidato", candidato.id, eleicao_id=eleicao_id, nome=candidato.nome)
    return candidato


@eleicao_routers.patch(
    "/{eleicao_id}/candidatos/{candidato_id}", response_model=CandidatoResposta
)
def atualizar_candidato(
    eleicao_id: int,
    candidato_id: int,
    dados: CandidatoAlterar,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Altera um candidato antes de a votação começar."""
    candidato = servico_candidato.atualizar_candidato(
        sessao, eleicao_id, candidato_id, dados
    )
    auditar(
        "Candidato alterado",
        "candidato",
        candidato.id,
        eleicao_id=eleicao_id,
        **dados.model_dump(exclude_unset=True),
    )
    return candidato


@eleicao_routers.delete(
    "/{eleicao_id}/candidatos/{candidato_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def apagar_candidato(
    eleicao_id: int,
    candidato_id: int,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Remove um candidato antes de a votação começar."""
    servico_candidato.apagar_candidato(sessao, eleicao_id, candidato_id)
    auditar("Candidato removido", "candidato", candidato_id, eleicao_id=eleicao_id)


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
    "/{eleicao_id}/habilitados", response_model=HabilitacaoLoteResposta
)
def habilitar(
    eleicao_id: int,
    dados: HabilitacaoLote,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Habilita vários utilizadores de uma vez."""
    resposta = servico_habilitacao.habilitar_lote(sessao, eleicao_id, dados.utilizador_ids)
    auditar("Eleitores habilitados", "eleicao", eleicao_id, adicionados=resposta.adicionados)
    return resposta


@eleicao_routers.delete(
    "/{eleicao_id}/habilitados/{utilizador_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
def desabilitar(
    eleicao_id: int,
    utilizador_id: int,
    sessao: Session = Depends(obter_sessao),
    auditar: Auditor = Depends(auditor_administrador),
):
    """Retira um utilizador do caderno eleitoral."""
    servico_habilitacao.desabilitar(sessao, eleicao_id, utilizador_id)
    auditar("Eleitor retirado do caderno", "eleicao", eleicao_id, utilizador_id=utilizador_id)
