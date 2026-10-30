from fastapi import APIRouter, status

from app.schemas.eleicao import (CandidatoAtualizarIn, CandidatoIn, CandidatoOut, EleicaoAtualizarIn,
                                 EleicaoCriarIn, EleicaoDetalheOut, EleicaoOut, HabilitacaoIn,
                                 HabilitacaoResultadoOut, HabilitadoOut, RondaAtualizarIn, RondaIn, RondaOut)
from app.security.dependencias import Admin, DbSession, UtilizadorAtual
from app.services import eleicao as servico

router = APIRouter(prefix="/eleicoes", tags=["eleições"])


# ------------------------------------------------------------ consulta (eleitores e admins)

@router.get("", response_model=list[EleicaoOut])
def listar(utilizador: UtilizadorAtual, db: DbSession, estado: str | None = None):
    """Admin: todas as eleições. Eleitor: só aquelas em que está habilitado (RF05)."""
    return servico.listar(db, utilizador, estado)


@router.get("/{eleicao_id}", response_model=EleicaoDetalheOut)
def detalhe(eleicao_id: int, utilizador: UtilizadorAtual, db: DbSession):
    return servico.obter_visivel(db, utilizador, eleicao_id)


# ------------------------------------------------------------ gestão da eleição (admin)

@router.post("", response_model=EleicaoOut, status_code=status.HTTP_201_CREATED)
def criar(dados: EleicaoCriarIn, admin: Admin, db: DbSession):
    return servico.criar(db, admin, dados.titulo, dados.descricao)


@router.patch("/{eleicao_id}", response_model=EleicaoOut)
def atualizar(eleicao_id: int, dados: EleicaoAtualizarIn, admin: Admin, db: DbSession):
    return servico.atualizar(db, admin, eleicao_id, dados.titulo, dados.descricao)


@router.delete("/{eleicao_id}", status_code=status.HTTP_204_NO_CONTENT)
def apagar(eleicao_id: int, admin: Admin, db: DbSession):
    servico.apagar(db, admin, eleicao_id)


@router.post("/{eleicao_id}/agendar", response_model=EleicaoDetalheOut)
def agendar(eleicao_id: int, admin: Admin, db: DbSession):
    return servico.agendar(db, admin, eleicao_id)


@router.post("/{eleicao_id}/iniciar", response_model=EleicaoDetalheOut)
def iniciar(eleicao_id: int, admin: Admin, db: DbSession):
    return servico.iniciar(db, admin, eleicao_id)


@router.post("/{eleicao_id}/encerrar", response_model=EleicaoDetalheOut)
def encerrar(eleicao_id: int, admin: Admin, db: DbSession):
    return servico.encerrar(db, admin, eleicao_id)


# ------------------------------------------------------------ rondas (admin)

@router.post("/{eleicao_id}/rondas", response_model=RondaOut, status_code=status.HTTP_201_CREATED)
def criar_ronda(eleicao_id: int, dados: RondaIn, admin: Admin, db: DbSession):
    """Sem rondas: cria a ronda 1. Com a ronda 1 encerrada: cria a 2.ª volta (candidato_ids com 2 ids)."""
    return servico.criar_ronda(db, admin, eleicao_id, dados.data_inicio, dados.data_fim, dados.candidato_ids)


@router.patch("/{eleicao_id}/rondas/{numero}", response_model=RondaOut)
def atualizar_ronda(eleicao_id: int, numero: int, dados: RondaAtualizarIn, admin: Admin, db: DbSession):
    return servico.atualizar_ronda(db, admin, eleicao_id, numero, dados.data_inicio, dados.data_fim)


@router.post("/{eleicao_id}/rondas/{numero}/abrir", response_model=RondaOut)
def abrir_ronda(eleicao_id: int, numero: int, admin: Admin, db: DbSession):
    return servico.abrir_ronda(db, admin, eleicao_id, numero)


@router.post("/{eleicao_id}/rondas/{numero}/encerrar", response_model=RondaOut)
def encerrar_ronda(eleicao_id: int, numero: int, admin: Admin, db: DbSession):
    return servico.encerrar_ronda(db, admin, eleicao_id, numero)


# ------------------------------------------------------------ candidatos (admin)

@router.post("/{eleicao_id}/candidatos", response_model=CandidatoOut, status_code=status.HTTP_201_CREATED)
def criar_candidato(eleicao_id: int, dados: CandidatoIn, admin: Admin, db: DbSession):
    return servico.criar_candidato(db, admin, eleicao_id, dados.nome, dados.partido, dados.descricao)


@router.patch("/{eleicao_id}/candidatos/{candidato_id}", response_model=CandidatoOut)
def atualizar_candidato(eleicao_id: int, candidato_id: int, dados: CandidatoAtualizarIn, admin: Admin,
                        db: DbSession):
    return servico.atualizar_candidato(db, admin, eleicao_id, candidato_id, dados.model_dump(exclude_unset=True))


@router.delete("/{eleicao_id}/candidatos/{candidato_id}", status_code=status.HTTP_204_NO_CONTENT)
def apagar_candidato(eleicao_id: int, candidato_id: int, admin: Admin, db: DbSession):
    servico.apagar_candidato(db, admin, eleicao_id, candidato_id)


# ------------------------------------------------------------ habilitações (admin)

@router.get("/{eleicao_id}/habilitados", response_model=list[HabilitadoOut])
def listar_habilitados(eleicao_id: int, _: Admin, db: DbSession):
    return [HabilitadoOut(utilizador_id=u.id, nome=u.nome, email=u.email, data=h.data)
            for h, u in servico.listar_habilitados(db, eleicao_id)]


@router.post("/{eleicao_id}/habilitados", response_model=HabilitacaoResultadoOut)
def habilitar(eleicao_id: int, dados: HabilitacaoIn, admin: Admin, db: DbSession):
    adicionados, ja = servico.habilitar(db, admin, eleicao_id, dados.utilizador_ids)
    return HabilitacaoResultadoOut(adicionados=adicionados, ja_habilitados=ja)


@router.delete("/{eleicao_id}/habilitados/{utilizador_id}", status_code=status.HTTP_204_NO_CONTENT)
def desabilitar(eleicao_id: int, utilizador_id: int, admin: Admin, db: DbSession):
    servico.desabilitar(db, admin, eleicao_id, utilizador_id)
