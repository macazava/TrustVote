"""Modelo SQLAlchemy da ronda (tabela `ronda` do trustvote.sql)."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Ronda(Base):
    __tablename__ = "ronda"

    id: Mapped[int] = mapped_column("ron_id", BigInteger, primary_key=True)
    eleicao_id: Mapped[int] = mapped_column("ron_ele_id", BigInteger)
    numero: Mapped[int] = mapped_column("ron_numero", SmallInteger)
    data_inicio: Mapped[datetime] = mapped_column(
        "ron_data_inicio", DateTime(timezone=True)
    )
    data_fim: Mapped[datetime] = mapped_column("ron_data_fim", DateTime(timezone=True))
    # `estado` tem valor por omissão na BD; nasce sempre em 'agendada'.
    estado: Mapped[str] = mapped_column(
        "ron_estado", String(50), server_default="agendada"
    )
