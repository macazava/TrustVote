from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import Candidato, Eleicao, Habilitacao, Utilizador


def por_id(db: Session, eleicao_id: int, *, bloquear: bool = False) -> Eleicao | None:
    """bloquear=True faz SELECT ... FOR UPDATE: duas instâncias do backend não conseguem
    mudar o estado da mesma eleição ao mesmo tempo (a segunda espera pela primeira)."""
    stmt = select(Eleicao).where(Eleicao.id == eleicao_id)
    if bloquear:
        # populate_existing: relê da BD mesmo que o objeto já esteja carregado na sessão
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    return db.scalar(stmt)


def listar(db: Session, estado: str | None = None) -> list[Eleicao]:
    stmt = select(Eleicao).order_by(Eleicao.id.desc())
    if estado:
        stmt = stmt.where(Eleicao.estado == estado)
    return list(db.scalars(stmt))


def listar_para_eleitor(db: Session, utilizador_id: int, estados: tuple[str, ...]) -> list[Eleicao]:
    stmt = (select(Eleicao)
            .join(Habilitacao, Habilitacao.eleicao_id == Eleicao.id)
            .where(Habilitacao.utilizador_id == utilizador_id, Eleicao.estado.in_(estados))
            .order_by(Eleicao.id.desc()))
    return list(db.scalars(stmt))


def esta_habilitado(db: Session, eleicao_id: int, utilizador_id: int) -> bool:
    return db.get(Habilitacao, (eleicao_id, utilizador_id)) is not None


def candidato(db: Session, eleicao_id: int, candidato_id: int) -> Candidato | None:
    return db.scalar(select(Candidato).where(Candidato.id == candidato_id, Candidato.eleicao_id == eleicao_id))


def habilitados(db: Session, eleicao_id: int) -> list[tuple[Habilitacao, Utilizador]]:
    stmt = (select(Habilitacao, Utilizador)
            .join(Utilizador, Utilizador.id == Habilitacao.utilizador_id)
            .where(Habilitacao.eleicao_id == eleicao_id)
            .order_by(Utilizador.nome))
    return [(h, u) for h, u in db.execute(stmt)]


def ids_habilitados(db: Session, eleicao_id: int) -> set[int]:
    return set(db.scalars(select(Habilitacao.utilizador_id).where(Habilitacao.eleicao_id == eleicao_id)))
