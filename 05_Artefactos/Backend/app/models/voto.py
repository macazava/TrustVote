"""Modelo SQLAlchemy do voto: EM QUEM se votou, sem dizer quem votou.

Tabela `voto` do trustvote.sql. Não tem ligação ao utilizador nem data, e o id é
um UUID aleatório, para não ser possível cruzar votos com participações.
"""

import uuid

from sqlalchemy import BigInteger, CHAR, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Voto(Base):
    __tablename__ = "voto"

    id: Mapped[uuid.UUID] = mapped_column(
        "vot_id", Uuid, primary_key=True, default=uuid.uuid4
    )
    ronda_id: Mapped[int] = mapped_column("vot_ron_id", BigInteger)
    candidato_id: Mapped[int] = mapped_column("vot_cand_id", BigInteger)
    # SHA-256 do recibo: permite confirmar o voto sem guardar o recibo.
    hash: Mapped[str] = mapped_column("vot_hash", CHAR(64))
