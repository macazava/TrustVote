"""Modelos SQLAlchemy da sondagem (intenção de voto, sem valor eleitoral).

Como no voto, quem respondeu (`sondagem_participacao`) e o que respondeu
(`sondagem_resposta`) ficam em tabelas sem ligação entre si.
"""

import uuid

from sqlalchemy import BigInteger, Uuid
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class SondagemParticipacao(Base):
    __tablename__ = "sondagem_participacao"

    eleicao_id: Mapped[int] = mapped_column("sp_ele_id", BigInteger, primary_key=True)
    utilizador_id: Mapped[int] = mapped_column("sp_ut_id", BigInteger, primary_key=True)


class SondagemResposta(Base):
    __tablename__ = "sondagem_resposta"

    id: Mapped[uuid.UUID] = mapped_column(
        "sr_id", Uuid, primary_key=True, default=uuid.uuid4
    )
    eleicao_id: Mapped[int] = mapped_column("sr_ele_id", BigInteger)
    candidato_id: Mapped[int] = mapped_column("sr_cand_id", BigInteger)
