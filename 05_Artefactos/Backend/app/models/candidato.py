"""Modelo SQLAlchemy do candidato (tabela `candidato` do trustvote.sql)."""

from sqlalchemy import BigInteger, Boolean, SmallInteger, String, Text, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Candidato(Base):
    __tablename__ = "candidato"

    id: Mapped[int] = mapped_column("cand_id", BigInteger, primary_key=True)
    eleicao_id: Mapped[int] = mapped_column("cand_ele_id", BigInteger)
    nome: Mapped[str] = mapped_column("cand_nome", String(255))
    orgao: Mapped[str] = mapped_column(
        "cand_orgao", String(50), server_default="direcao"
    )
    curso: Mapped[str | None] = mapped_column("cand_curso", String(150))
    ano: Mapped[int | None] = mapped_column("cand_ano", SmallInteger)
    descricao: Mapped[str | None] = mapped_column("cand_descricao", Text)
    ativo: Mapped[bool] = mapped_column(
        "cand_ativo", Boolean, server_default=text("TRUE")
    )
