"""Modelo SQLAlchemy do resultado apurado (tabela `resultado` do trustvote.sql).

Uma linha por candidato de cada ronda apurada; a linha com `candidato_id` a
None guarda os votos em branco.
"""

from datetime import datetime
from decimal import Decimal

from sqlalchemy import BigInteger, DateTime, Integer, Numeric, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Resultado(Base):
    __tablename__ = "resultado"

    id: Mapped[int] = mapped_column("res_id", BigInteger, primary_key=True)
    ronda_id: Mapped[int] = mapped_column("res_ron_id", BigInteger)
    candidato_id: Mapped[int | None] = mapped_column("res_cand_id", BigInteger)
    total_votos: Mapped[int] = mapped_column("res_total_votos", Integer)
    percentagem: Mapped[Decimal] = mapped_column("res_percentagem", Numeric(5, 2))
    apurado_em: Mapped[datetime] = mapped_column(
        "res_data", DateTime(timezone=True), server_default=func.now()
    )
