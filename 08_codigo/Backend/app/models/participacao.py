"""Modelo SQLAlchemy da participação: QUEM votou, sem dizer em quem.

Tabela `participacao` do trustvote.sql. A restrição única (ronda + utilizador)
é o que garante um voto por eleitor, mesmo com várias instâncias da API.
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Participacao(Base):
    __tablename__ = "participacao"

    id: Mapped[int] = mapped_column("part_id", BigInteger, primary_key=True)
    ronda_id: Mapped[int] = mapped_column("part_ron_id", BigInteger)
    utilizador_id: Mapped[int] = mapped_column("part_ut_id", BigInteger)
    registada_em: Mapped[datetime] = mapped_column(
        "part_data", DateTime(timezone=True), server_default=func.now()
    )
