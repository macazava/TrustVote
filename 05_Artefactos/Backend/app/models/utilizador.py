from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, Identity, String, Text, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base

PERFIL_ELEITOR = "eleitor"
PERFIL_ADMIN = "administrador"
PERFIS = (PERFIL_ELEITOR, PERFIL_ADMIN)


class Utilizador(Base):
    __tablename__ = "utilizador"

    id: Mapped[int] = mapped_column("ut_id", BigInteger, Identity(always=True), primary_key=True)
    nome: Mapped[str] = mapped_column("ut_nome", String(255))
    email: Mapped[str] = mapped_column("ut_email", String(255), unique=True)
    password_hash: Mapped[str] = mapped_column("ut_password_hash", String(255))
    perfil: Mapped[str] = mapped_column("ut_perfil", String(20), server_default=PERFIL_ELEITOR)
    ativo: Mapped[bool] = mapped_column("ut_ativo", Boolean, server_default=text("true"))
    data_registo: Mapped[datetime] = mapped_column("ut_datareg", DateTime(timezone=True), server_default=func.now())
    totp_segredo: Mapped[str | None] = mapped_column("ut_totp_segredo", Text)
    totp_ativo: Mapped[bool] = mapped_column("ut_totp_ativo", Boolean, server_default=text("false"))
    totp_ultimo_passo: Mapped[int | None] = mapped_column("ut_totp_ultimo_passo", BigInteger)

    @property
    def is_admin(self) -> bool:
        return self.perfil == PERFIL_ADMIN
