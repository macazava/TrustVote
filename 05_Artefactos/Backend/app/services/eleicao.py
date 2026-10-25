"""Gestão eleitoral (RF03, RF04, RF05): eleições, rondas, candidatos e habilitações.

Ciclo de vida de uma eleição:

    rascunho --agendar--> agendada --iniciar--> em_curso --encerrar--> encerrada
       |                     |
       +---- editar / candidatos / ronda 1 / habilitações ----+   (habilitações também em agendada)

    - agendar:  exige ronda 1 com fim no futuro, >= 2 candidatos ativos e >= 1 eleitor habilitado.
                Fixa os candidatos da ronda 1 (todos os candidatos ativos).
    - iniciar:  abre a ronda 1 (aberta). O período (data_inicio/data_fim) é validado no momento
                do voto pelo módulo de votação; aqui só se controla o estado.
    - 2.ª volta: com a eleição em_curso e a ronda 1 encerrada/apurada, cria-se a ronda 2 com
                exatamente 2 candidatos e abre-se com abrir_ronda.
    - encerrar: fecha a ronda que estiver aberta e a eleição.

Todas as mudanças de estado usam SELECT ... FOR UPDATE na eleição, para que dois pedidos
simultâneos (mesmo em instâncias diferentes do backend) não deixem a eleição inconsistente.
"""
from datetime import datetime, timezone

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models import Candidato, Eleicao, Habilitacao, Ronda, Utilizador
from app.models.eleicao import (ELEICAO_AGENDADA, ELEICAO_EM_CURSO, ELEICAO_ENCERRADA, ELEICAO_RASCUNHO,
                                RONDA_ABERTA, RONDA_AGENDADA, RONDA_APURADA, RONDA_ENCERRADA)
from app.models.utilizador import PERFIL_ELEITOR
from app.repositories import eleicao as repo
from app.repositories import utilizador as repo_utilizador
from app.services import auditoria
from app.services.erros import Conflito, DadosInvalidos, NaoEncontrado

# Estados em que um eleitor habilitado pode ver a eleição (um rascunho só é visível para admins)
ESTADOS_VISIVEIS_ELEITOR = (ELEICAO_AGENDADA, ELEICAO_EM_CURSO, ELEICAO_ENCERRADA)


def _agora() -> datetime:
    return datetime.now(timezone.utc)


def _obter(db: Session, eleicao_id: int, *, bloquear: bool = False) -> Eleicao:
    eleicao = repo.por_id(db, eleicao_id, bloquear=bloquear)
    if eleicao is None:
        raise NaoEncontrado("Eleição não encontrada")
    return eleicao


def _exigir_estado(eleicao: Eleicao, *estados: str, acao: str) -> None:
    if eleicao.estado not in estados:
        raise Conflito(f"Não é possível {acao}: a eleição está '{eleicao.estado}' "
                       f"(permitido em: {', '.join(estados)})")


def _auditar(db: Session, admin: Utilizador, acao: str, eleicao: Eleicao, **detalhes) -> None:
    auditoria.registar(db, acao, utilizador_id=admin.id, entidade="eleicao", entidade_id=eleicao.id,
                       detalhes=detalhes or None)


# ---------------------------------------------------------------- leitura (regras de acesso)

def listar(db: Session, utilizador: Utilizador, estado: str | None = None) -> list[Eleicao]:
    if utilizador.is_admin:
        return repo.listar(db, estado)
    estados = ESTADOS_VISIVEIS_ELEITOR if estado is None else tuple(
        e for e in ESTADOS_VISIVEIS_ELEITOR if e == estado)
    return repo.listar_para_eleitor(db, utilizador.id, estados)


def obter_visivel(db: Session, utilizador: Utilizador, eleicao_id: int) -> Eleicao:
    """Admins veem tudo. Um eleitor só vê eleições em que está habilitado e que já não são rascunho.
    Para os restantes casos responde 404 (não revela que a eleição existe)."""
    eleicao = _obter(db, eleicao_id)
    if utilizador.is_admin:
        return eleicao
    if eleicao.estado in ESTADOS_VISIVEIS_ELEITOR and repo.esta_habilitado(db, eleicao_id, utilizador.id):
        return eleicao
    raise NaoEncontrado("Eleição não encontrada")


# ---------------------------------------------------------------- eleição

def criar(db: Session, admin: Utilizador, titulo: str, descricao: str | None) -> Eleicao:
    eleicao = Eleicao(titulo=titulo.strip(), descricao=descricao, criador_id=admin.id, estado=ELEICAO_RASCUNHO)
    db.add(eleicao)
    db.flush()
    _auditar(db, admin, "eleicao.criada", eleicao, titulo=eleicao.titulo)
    db.commit()
    return eleicao


def atualizar(db: Session, admin: Utilizador, eleicao_id: int, titulo: str | None, descricao: str | None) -> Eleicao:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_RASCUNHO, ELEICAO_AGENDADA, acao="editar a eleição")
    if titulo is not None:
        eleicao.titulo = titulo.strip()
    if descricao is not None:
        eleicao.descricao = descricao
    _auditar(db, admin, "eleicao.editada", eleicao)
    db.commit()
    return eleicao


def apagar(db: Session, admin: Utilizador, eleicao_id: int) -> None:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_RASCUNHO, acao="apagar a eleição")
    _auditar(db, admin, "eleicao.apagada", eleicao, titulo=eleicao.titulo)
    db.delete(eleicao)
    db.commit()


def agendar(db: Session, admin: Utilizador, eleicao_id: int) -> Eleicao:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_RASCUNHO, acao="agendar")
    ronda1 = eleicao.ronda(1)
    if ronda1 is None:
        raise Conflito("Defina a ronda 1 (datas da votação) antes de agendar")
    if ronda1.data_fim <= _agora():
        raise Conflito("A ronda 1 já terminou; corrija as datas")
    ativos = [c for c in eleicao.candidatos if c.ativo]
    if len(ativos) < 2:
        raise Conflito("São necessários pelo menos 2 candidatos ativos")
    if not repo.ids_habilitados(db, eleicao.id):
        raise Conflito("Habilite pelo menos um eleitor antes de agendar")
    ronda1.candidatos = ativos  # a lista de candidatos da 1.ª volta fica fixa a partir daqui
    eleicao.estado = ELEICAO_AGENDADA
    _auditar(db, admin, "eleicao.agendada", eleicao, candidatos=[c.id for c in ativos])
    db.commit()
    return eleicao


def iniciar(db: Session, admin: Utilizador, eleicao_id: int) -> Eleicao:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_AGENDADA, acao="iniciar")
    eleicao.estado = ELEICAO_EM_CURSO
    eleicao.ronda(1).estado = RONDA_ABERTA
    _auditar(db, admin, "eleicao.iniciada", eleicao)
    db.commit()
    return eleicao


def encerrar(db: Session, admin: Utilizador, eleicao_id: int) -> Eleicao:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_EM_CURSO, acao="encerrar")
    for ronda in eleicao.rondas:
        if ronda.estado in (RONDA_AGENDADA, RONDA_ABERTA):
            ronda.estado = RONDA_ENCERRADA
    eleicao.estado = ELEICAO_ENCERRADA
    _auditar(db, admin, "eleicao.encerrada", eleicao)
    db.commit()
    return eleicao


# ---------------------------------------------------------------- rondas

def criar_ronda(db: Session, admin: Utilizador, eleicao_id: int, data_inicio: datetime, data_fim: datetime,
                candidato_ids: list[int] | None) -> Ronda:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    ronda1 = eleicao.ronda(1)

    if ronda1 is None:  # 1.ª volta
        _exigir_estado(eleicao, ELEICAO_RASCUNHO, acao="criar a ronda 1")
        if candidato_ids:
            raise DadosInvalidos("Na ronda 1 concorrem todos os candidatos ativos; não indique candidato_ids")
        ronda = Ronda(eleicao_id=eleicao.id, numero=1, data_inicio=data_inicio, data_fim=data_fim,
                      estado=RONDA_AGENDADA)
    else:  # 2.ª volta
        if eleicao.ronda(2) is not None:
            raise Conflito("A eleição já tem 2 rondas")
        _exigir_estado(eleicao, ELEICAO_EM_CURSO, acao="criar a 2.ª volta")
        if ronda1.estado not in (RONDA_ENCERRADA, RONDA_APURADA):
            raise Conflito("A ronda 1 tem de estar encerrada antes de criar a 2.ª volta")
        if data_inicio < ronda1.data_fim:
            raise DadosInvalidos("A 2.ª volta tem de começar depois do fim da ronda 1")
        ids = set(candidato_ids or [])
        if len(ids) != 2:
            raise DadosInvalidos("A 2.ª volta tem exatamente 2 candidatos (candidato_ids)")
        da_ronda1 = {c.id: c for c in ronda1.candidatos}
        if not ids.issubset(da_ronda1):
            raise DadosInvalidos("Os candidatos da 2.ª volta têm de ter concorrido na ronda 1")
        ronda = Ronda(eleicao_id=eleicao.id, numero=2, data_inicio=data_inicio, data_fim=data_fim,
                      estado=RONDA_AGENDADA, candidatos=[da_ronda1[i] for i in sorted(ids)])

    db.add(ronda)
    db.flush()
    _auditar(db, admin, "ronda.criada", eleicao, ronda=ronda.numero)
    db.commit()
    db.refresh(eleicao)
    return ronda


def _obter_ronda(eleicao: Eleicao, numero: int) -> Ronda:
    ronda = eleicao.ronda(numero)
    if ronda is None:
        raise NaoEncontrado(f"A eleição não tem ronda {numero}")
    return ronda


def atualizar_ronda(db: Session, admin: Utilizador, eleicao_id: int, numero: int,
                    data_inicio: datetime | None, data_fim: datetime | None) -> Ronda:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    ronda = _obter_ronda(eleicao, numero)
    if ronda.estado != RONDA_AGENDADA:
        raise Conflito(f"Não é possível alterar as datas: a ronda está '{ronda.estado}'")
    if numero == 1:
        _exigir_estado(eleicao, ELEICAO_RASCUNHO, ELEICAO_AGENDADA, acao="alterar as datas da ronda 1")
    inicio = data_inicio or ronda.data_inicio
    fim = data_fim or ronda.data_fim
    if fim <= inicio:
        raise DadosInvalidos("data_fim tem de ser posterior a data_inicio")
    ronda.data_inicio, ronda.data_fim = inicio, fim
    _auditar(db, admin, "ronda.editada", eleicao, ronda=numero)
    db.commit()
    return ronda


def abrir_ronda(db: Session, admin: Utilizador, eleicao_id: int, numero: int) -> Ronda:
    """Abre a 2.ª volta (a ronda 1 é aberta por iniciar())."""
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_EM_CURSO, acao="abrir a ronda")
    ronda = _obter_ronda(eleicao, numero)
    if numero == 1:
        raise Conflito("A ronda 1 é aberta ao iniciar a eleição")
    if ronda.estado != RONDA_AGENDADA:
        raise Conflito(f"A ronda está '{ronda.estado}'")
    ronda.estado = RONDA_ABERTA
    _auditar(db, admin, "ronda.aberta", eleicao, ronda=numero)
    db.commit()
    return ronda


def encerrar_ronda(db: Session, admin: Utilizador, eleicao_id: int, numero: int) -> Ronda:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_EM_CURSO, acao="encerrar a ronda")
    ronda = _obter_ronda(eleicao, numero)
    if ronda.estado != RONDA_ABERTA:
        raise Conflito(f"Só uma ronda aberta pode ser encerrada (está '{ronda.estado}')")
    ronda.estado = RONDA_ENCERRADA
    _auditar(db, admin, "ronda.encerrada", eleicao, ronda=numero)
    db.commit()
    return ronda


# ---------------------------------------------------------------- candidatos

def criar_candidato(db: Session, admin: Utilizador, eleicao_id: int, nome: str, partido: str | None,
                    descricao: str | None) -> Candidato:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_RASCUNHO, acao="adicionar candidatos")
    candidato = Candidato(eleicao_id=eleicao.id, nome=nome.strip(), partido=partido, descricao=descricao)
    db.add(candidato)
    db.flush()
    _auditar(db, admin, "candidato.criado", eleicao, candidato=candidato.id, nome=candidato.nome)
    db.commit()
    return candidato


def atualizar_candidato(db: Session, admin: Utilizador, eleicao_id: int, candidato_id: int, dados: dict) -> Candidato:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_RASCUNHO, acao="alterar candidatos")
    candidato = repo.candidato(db, eleicao_id, candidato_id)
    if candidato is None:
        raise NaoEncontrado("Candidato não encontrado")
    for campo, valor in dados.items():
        setattr(candidato, campo, valor)
    _auditar(db, admin, "candidato.editado", eleicao, candidato=candidato.id)
    db.commit()
    return candidato


def apagar_candidato(db: Session, admin: Utilizador, eleicao_id: int, candidato_id: int) -> None:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_RASCUNHO, acao="remover candidatos")
    candidato = repo.candidato(db, eleicao_id, candidato_id)
    if candidato is None:
        raise NaoEncontrado("Candidato não encontrado")
    _auditar(db, admin, "candidato.apagado", eleicao, candidato=candidato.id, nome=candidato.nome)
    db.delete(candidato)
    db.commit()


# ---------------------------------------------------------------- habilitações

def habilitar(db: Session, admin: Utilizador, eleicao_id: int, utilizador_ids: list[int]) -> tuple[int, int]:
    """Habilita eleitores. Devolve (adicionados, já_habilitados). Só eleitores ativos."""
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_RASCUNHO, ELEICAO_AGENDADA, acao="alterar habilitações")
    ids = set(utilizador_ids)
    encontrados = {u.id: u for u in repo_utilizador.por_ids(db, list(ids))}
    em_falta = sorted(ids - encontrados.keys())
    if em_falta:
        raise NaoEncontrado(f"Utilizadores não encontrados: {em_falta}")
    invalidos = sorted(u.id for u in encontrados.values() if u.perfil != PERFIL_ELEITOR or not u.ativo)
    if invalidos:
        raise DadosInvalidos(f"Só eleitores ativos podem ser habilitados: {invalidos}")
    ja = repo.ids_habilitados(db, eleicao.id) & ids
    novos = sorted(ids - ja)
    if novos:
        db.execute(insert(Habilitacao).values([{"eleicao_id": eleicao.id, "utilizador_id": i} for i in novos])
                   .on_conflict_do_nothing())
        _auditar(db, admin, "habilitacao.adicionada", eleicao, utilizadores=novos)
    db.commit()
    return len(novos), len(ja)


def desabilitar(db: Session, admin: Utilizador, eleicao_id: int, utilizador_id: int) -> None:
    eleicao = _obter(db, eleicao_id, bloquear=True)
    _exigir_estado(eleicao, ELEICAO_RASCUNHO, ELEICAO_AGENDADA, acao="alterar habilitações")
    hab = db.get(Habilitacao, (eleicao.id, utilizador_id))
    if hab is None:
        raise NaoEncontrado("O utilizador não está habilitado nesta eleição")
    db.delete(hab)
    _auditar(db, admin, "habilitacao.removida", eleicao, utilizador=utilizador_id)
    db.commit()


def listar_habilitados(db: Session, eleicao_id: int):
    _obter(db, eleicao_id)
    return repo.habilitados(db, eleicao_id)
