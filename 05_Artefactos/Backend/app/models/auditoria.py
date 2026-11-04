"""Modelo SQLAlchemy do registo de auditoria (tabela `auditoria` do trustvote.sql).

Cada registo guarda o hash do anterior, formando uma cadeia: apagar ou alterar
um registo antigo quebra a cadeia a partir desse ponto.
"""

from datetime import datetime

from sqlalchemy import BigInteger, CHAR, DateTime, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Auditoria(Base):
    __tablename__ = "auditoria"

    id: Mapped[int] = mapped_column("aud_id", BigInteger, primary_key=True)
    # None = ação do sistema (ex.: fecho automático de uma ronda).
    utilizador_id: Mapped[int | None] = mapped_column("aud_ut_id", BigInteger)
    acao: Mapped[str] = mapped_column("aud_acao", String(80))
    entidade: Mapped[str | None] = mapped_column("aud_entidade", String(50))
    entidade_id: Mapped[int | None] = mapped_column("aud_entidade_id", BigInteger)
    detalhes: Mapped[dict | None] = mapped_column("aud_detalhes", JSONB)
    ip: Mapped[str | None] = mapped_column("aud_ip", String(45))
    hash_anterior: Mapped[str | None] = mapped_column("aud_hash_anterior", CHAR(64))
    hash_atual: Mapped[str | None] = mapped_column("aud_hash_atual", CHAR(64))
    data: Mapped[datetime] = mapped_column(
        "aud_data", DateTime(timezone=True), server_default=func.now()
    )
