from datetime import datetime

from sqlalchemy import (BigInteger, Boolean, DateTime, ForeignKey, Identity, SmallInteger, String, Text,
                        func, text)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base

# Estados da eleição: rascunho -> agendada -> em_curso -> encerrada
ELEICAO_RASCUNHO = "rascunho"
ELEICAO_AGENDADA = "agendada"
ELEICAO_EM_CURSO = "em_curso"
ELEICAO_ENCERRADA = "encerrada"

# Estados da ronda: agendada -> aberta -> encerrada -> apurada (apurada = worker de resultados)
RONDA_AGENDADA = "agendada"
RONDA_ABERTA = "aberta"
RONDA_ENCERRADA = "encerrada"
RONDA_APURADA = "apurada"


class Eleicao(Base):
    __tablename__ = "eleicao"

    id: Mapped[int] = mapped_column("ele_id", BigInteger, Identity(always=True), primary_key=True)
    titulo: Mapped[str] = mapped_column("ele_titulo", String(150))
    descricao: Mapped[str | None] = mapped_column("ele_descricao", Text)
    estado: Mapped[str] = mapped_column("ele_estado", String(50), server_default=ELEICAO_RASCUNHO)
    criador_id: Mapped[int] = mapped_column("ele_ut_id", BigInteger, ForeignKey("utilizador.ut_id"))
    data_criacao: Mapped[datetime] = mapped_column("ele_data", DateTime(timezone=True), server_default=func.now())

    rondas: Mapped[list["Ronda"]] = relationship(back_populates="eleicao", order_by="Ronda.numero",
                                                 cascade="all, delete-orphan", passive_deletes=True)
    candidatos: Mapped[list["Candidato"]] = relationship(back_populates="eleicao", order_by="Candidato.id",
                                                         cascade="all, delete-orphan", passive_deletes=True)

    def ronda(self, numero: int) -> "Ronda | None":
        return next((r for r in self.rondas if r.numero == numero), None)

    def ronda_atual(self) -> "Ronda | None":
        """A ronda que interessa mostrar: a aberta, senão a agendada, senão a última (igual ao frontend)."""
        return (next((r for r in self.rondas if r.estado == RONDA_ABERTA), None)
                or next((r for r in self.rondas if r.estado == RONDA_AGENDADA), None)
                or (self.rondas[-1] if self.rondas else None))


class Ronda(Base):
    __tablename__ = "ronda"

    id: Mapped[int] = mapped_column("ron_id", BigInteger, Identity(always=True), primary_key=True)
    eleicao_id: Mapped[int] = mapped_column("ron_ele_id", BigInteger, ForeignKey("eleicao.ele_id", ondelete="CASCADE"))
    numero: Mapped[int] = mapped_column("ron_numero", SmallInteger)
    data_inicio: Mapped[datetime] = mapped_column("ron_data_inicio", DateTime(timezone=True))
    data_fim: Mapped[datetime] = mapped_column("ron_data_fim", DateTime(timezone=True))
    estado: Mapped[str] = mapped_column("ron_estado", String(50), server_default=RONDA_AGENDADA)

    eleicao: Mapped[Eleicao] = relationship(back_populates="rondas")
    candidatos: Mapped[list["Candidato"]] = relationship(secondary="ronda_candidato", order_by="Candidato.id")


class Candidato(Base):
    __tablename__ = "candidato"

    id: Mapped[int] = mapped_column("cand_id", BigInteger, Identity(always=True), primary_key=True)
    eleicao_id: Mapped[int] = mapped_column("cand_ele_id", BigInteger,
                                            ForeignKey("eleicao.ele_id", ondelete="CASCADE"))
    nome: Mapped[str] = mapped_column("cand_nome", String(255))
    partido: Mapped[str | None] = mapped_column("cand_partido", String(255))
    descricao: Mapped[str | None] = mapped_column("cand_descricao", Text)
    ativo: Mapped[bool] = mapped_column("cand_ativo", Boolean, server_default=text("true"))

    eleicao: Mapped[Eleicao] = relationship(back_populates="candidatos")


class RondaCandidato(Base):
    __tablename__ = "ronda_candidato"

    ronda_id: Mapped[int] = mapped_column("rc_ron_id", BigInteger, ForeignKey("ronda.ron_id", ondelete="CASCADE"),
                                          primary_key=True)
    candidato_id: Mapped[int] = mapped_column("rc_cand_id", BigInteger,
                                              ForeignKey("candidato.cand_id", ondelete="CASCADE"), primary_key=True)


class Habilitacao(Base):
    __tablename__ = "habilitacao"

    eleicao_id: Mapped[int] = mapped_column("hab_ele_id", BigInteger, ForeignKey("eleicao.ele_id", ondelete="CASCADE"),
                                            primary_key=True)
    utilizador_id: Mapped[int] = mapped_column("hab_ut_id", BigInteger,
                                               ForeignKey("utilizador.ut_id", ondelete="CASCADE"), primary_key=True)
    data: Mapped[datetime] = mapped_column("hab_data", DateTime(timezone=True), server_default=func.now())
