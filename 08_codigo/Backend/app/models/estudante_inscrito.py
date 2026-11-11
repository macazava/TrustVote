"""Modelo SQLAlchemy da lista oficial de estudantes (tabela `estudante_inscrito`).

Com REGISTO_RESTRITO=true só os números desta lista podem criar conta.
"""

from datetime import datetime

from sqlalchemy import DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class EstudanteInscrito(Base):
    __tablename__ = "estudante_inscrito"

    num_estudante: Mapped[str] = mapped_column(
        "ei_num_estudante", String(20), primary_key=True
    )
    nome: Mapped[str | None] = mapped_column("ei_nome", String(255))
    curso: Mapped[str | None] = mapped_column("ei_curso", String(150))
    inscrito_em: Mapped[datetime] = mapped_column(
        "ei_data", DateTime(timezone=True), server_default=func.now()
    )
