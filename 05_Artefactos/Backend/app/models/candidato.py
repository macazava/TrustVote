"""Modelo SQLAlchemy do candidato (tabela `candidato` do trustvote.sql)."""

from sqlalchemy import BigInteger, Boolean, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Candidato(Base):
    __tablename__ = "candidato"

    id: Mapped[int] = mapped_column("cand_id", BigInteger, primary_key=True)
    eleicao_id: Mapped[int] = mapped_column("cand_ele_id", BigInteger)
    nome: Mapped[str] = mapped_column("cand_nome", String(255))
    partido: Mapped[str | None] = mapped_column("cand_partido", String(255))
    descricao: Mapped[str | None] = mapped_column("cand_descricao", Text)
    ativo: Mapped[bool] = mapped_column(
        "cand_ativo", Boolean, server_default=text("TRUE")
    )
