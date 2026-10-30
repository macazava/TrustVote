"""Modelo SQLAlchemy da eleição (tabela `eleicao` do trustvote.sql)."""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Eleicao(Base):
    __tablename__ = "eleicao"

    id: Mapped[int] = mapped_column("ele_id", BigInteger, primary_key=True)
    titulo: Mapped[str] = mapped_column("ele_titulo", String(150))
    descricao: Mapped[str | None] = mapped_column("ele_descricao", Text)
    # `estado` tem valor por omissão na BD; nasce sempre em 'rascunho'.
    estado: Mapped[str] = mapped_column(
        "ele_estado", String(50), server_default="rascunho"
    )
    criador_id: Mapped[int] = mapped_column("ele_ut_id", BigInteger)
    criada_em: Mapped[datetime] = mapped_column(
        "ele_data", DateTime(timezone=True), server_default=func.now()
    )
