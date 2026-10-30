"""Modelo SQLAlchemy da habilitação: quem pode votar em cada eleição.

Tabela `habilitacao` do trustvote.sql: chave primária composta, sem coluna de
id própria.
"""

from datetime import datetime

from sqlalchemy import BigInteger, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Habilitacao(Base):
    __tablename__ = "habilitacao"

    eleicao_id: Mapped[int] = mapped_column("hab_ele_id", BigInteger, primary_key=True)
    utilizador_id: Mapped[int] = mapped_column(
        "hab_ut_id", BigInteger, primary_key=True
    )
    registada_em: Mapped[datetime] = mapped_column(
        "hab_data", DateTime(timezone=True), server_default=func.now()
    )
