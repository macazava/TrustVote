"""Modelo SQLAlchemy do candidato que concorre numa ronda.

Tabela `ronda_candidato` do trustvote.sql: chave primária composta, sem coluna
de id própria.
"""

from sqlalchemy import BigInteger
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class RondaCandidato(Base):
    __tablename__ = "ronda_candidato"

    ronda_id: Mapped[int] = mapped_column("rc_ron_id", BigInteger, primary_key=True)
    candidato_id: Mapped[int] = mapped_column(
        "rc_cand_id", BigInteger, primary_key=True
    )
