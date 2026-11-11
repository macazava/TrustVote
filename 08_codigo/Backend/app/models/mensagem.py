"""Modelo SQLAlchemy das mensagens do formulário de contacto (tabela `mensagem_contacto`)."""

from datetime import datetime

from sqlalchemy import Boolean, DateTime, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MensagemContacto(Base):
    __tablename__ = "mensagem_contacto"

    id: Mapped[int] = mapped_column("mc_id", Integer, primary_key=True)
    nome: Mapped[str] = mapped_column("mc_nome", String(80))
    email: Mapped[str] = mapped_column("mc_email", String(255))
    assunto: Mapped[str] = mapped_column("mc_assunto", String(80))
    mensagem: Mapped[str] = mapped_column("mc_mensagem", String(1500))
    lida: Mapped[bool] = mapped_column("mc_lida", Boolean, default=False)
    data: Mapped[datetime] = mapped_column(
        "mc_data", DateTime(timezone=True), server_default=func.now()
    )
