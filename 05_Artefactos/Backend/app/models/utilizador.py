"""Modelo SQLAlchemy do utilizador registado.

A tabela é a `utilizador` definida em
`config/database/init/docker_sql_and_sh/trustvote.sql`, que é a fonte única do
esquema. Os atributos em Python mantêm nomes legíveis para a API; o mapeamento
para as colunas `ut_*` é feito aqui.
"""

from datetime import datetime

from sqlalchemy import BigInteger, Boolean, DateTime, String, func, text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class Utilizador(Base):
    __tablename__ = "utilizador"

    id: Mapped[int] = mapped_column("ut_id", BigInteger, primary_key=True)
    nome_utilizador: Mapped[str] = mapped_column("ut_nome", String(255), unique=True)
    email: Mapped[str] = mapped_column("ut_email", String(255), unique=True)
    num_estudante: Mapped[str] = mapped_column(
        "ut_num_estudante", String(20), unique=True
    )
    curso: Mapped[str | None] = mapped_column("ut_curso", String(150))
    password_hash: Mapped[str] = mapped_column("ut_password_hash", String(255))
    # `perfil` e `ativo` têm valor por omissão na BD: ao criar, o SQLAlchemy
    # omite-os do INSERT e é o servidor que aplica 'eleitor' / TRUE.
    perfil: Mapped[str] = mapped_column("ut_perfil", String(20), server_default="eleitor")
    ativo: Mapped[bool] = mapped_column(
        "ut_ativo", Boolean, server_default=text("TRUE")
    )
    criado_em: Mapped[datetime] = mapped_column(
        "ut_datareg", DateTime(timezone=True), server_default=func.now()
    )
