from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Utilizador


def por_email(db: Session, email: str) -> Utilizador | None:
    # emails comparados sem distinguir maiúsculas/minúsculas
    return db.scalar(select(Utilizador).where(func.lower(Utilizador.email) == email.lower()))


def por_id(db: Session, utilizador_id: int, *, bloquear: bool = False) -> Utilizador | None:
    stmt = select(Utilizador).where(Utilizador.id == utilizador_id)
    if bloquear:
        # populate_existing: relê da BD mesmo que o objeto já esteja carregado na sessão
        stmt = stmt.with_for_update().execution_options(populate_existing=True)
    return db.scalar(stmt)


def listar(db: Session, perfil: str | None = None) -> list[Utilizador]:
    stmt = select(Utilizador).order_by(Utilizador.id)
    if perfil:
        stmt = stmt.where(Utilizador.perfil == perfil)
    return list(db.scalars(stmt))


def por_ids(db: Session, ids: list[int]) -> list[Utilizador]:
    return list(db.scalars(select(Utilizador).where(Utilizador.id.in_(ids))))
