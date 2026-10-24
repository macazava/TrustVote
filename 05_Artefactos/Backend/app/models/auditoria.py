from datetime import datetime

from sqlalchemy import BigInteger, CHAR, DateTime, ForeignKey, Identity, String, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Auditoria(Base):
    __tablename__ = "auditoria"

    id: Mapped[int] = mapped_column("aud_id", BigInteger, Identity(always=True), primary_key=True)
    utilizador_id: Mapped[int | None] = mapped_column("aud_ut_id", BigInteger,
                                                      ForeignKey("utilizador.ut_id", ondelete="SET NULL"))
    acao: Mapped[str] = mapped_column("aud_acao", String(80))
    entidade: Mapped[str | None] = mapped_column("aud_entidade", String(50))
    entidade_id: Mapped[int | None] = mapped_column("aud_entidade_id", BigInteger)
    detalhes: Mapped[dict | None] = mapped_column("aud_detalhes", JSONB)
    ip: Mapped[str | None] = mapped_column("aud_ip", String(45))
    hash_anterior: Mapped[str | None] = mapped_column("aud_hash_anterior", CHAR(64))
    hash_atual: Mapped[str | None] = mapped_column("aud_hash_atual", CHAR(64))
    data: Mapped[datetime] = mapped_column("aud_data", DateTime(timezone=True), server_default=func.now())
