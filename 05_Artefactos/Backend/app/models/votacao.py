"""Votação: participação (QUEM votou) e voto (EM QUEM se votou) em tabelas separadas.

A participação não guarda o candidato e o voto não guarda o eleitor nem a hora: não há
coluna que ligue as duas. O vot_id é um UUID aleatório (não sequencial).
"""
import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (CHAR, BigInteger, DateTime, ForeignKey, ForeignKeyConstraint, Identity, Integer,
                        Numeric, func)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Participacao(Base):
    __tablename__ = "participacao"

    id: Mapped[int] = mapped_column("part_id", BigInteger, Identity(always=True), primary_key=True)
    ronda_id: Mapped[int] = mapped_column("part_ron_id", BigInteger, ForeignKey("ronda.ron_id"))
    utilizador_id: Mapped[int] = mapped_column("part_ut_id", BigInteger, ForeignKey("utilizador.ut_id"))
    data: Mapped[datetime] = mapped_column("part_data", DateTime(timezone=True), server_default=func.now())


class Voto(Base):
    __tablename__ = "voto"
    __table_args__ = (ForeignKeyConstraint(["vot_ron_id", "vot_cand_id"],
                                           ["ronda_candidato.rc_ron_id", "ronda_candidato.rc_cand_id"]),)

    id: Mapped[uuid.UUID] = mapped_column("vot_id", UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    ronda_id: Mapped[int] = mapped_column("vot_ron_id", BigInteger)
    candidato_id: Mapped[int] = mapped_column("vot_cand_id", BigInteger)
    hash: Mapped[str] = mapped_column("vot_hash", CHAR(64))


class Resultado(Base):
    __tablename__ = "resultado"
    __table_args__ = (ForeignKeyConstraint(["res_ron_id", "res_cand_id"],
                                           ["ronda_candidato.rc_ron_id", "ronda_candidato.rc_cand_id"]),)

    id: Mapped[int] = mapped_column("res_id", BigInteger, Identity(always=True), primary_key=True)
    ronda_id: Mapped[int] = mapped_column("res_ron_id", BigInteger)
    candidato_id: Mapped[int] = mapped_column("res_cand_id", BigInteger)
    total_votos: Mapped[int] = mapped_column("res_total_votos", Integer)
    percentagem: Mapped[Decimal] = mapped_column("res_percentagem", Numeric(5, 2))
    data: Mapped[datetime] = mapped_column("res_data", DateTime(timezone=True), server_default=func.now())
