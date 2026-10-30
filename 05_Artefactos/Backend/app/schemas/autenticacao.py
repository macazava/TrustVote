from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator


def validar_password(v: str) -> str:
    if not (any(c.isalpha() for c in v) and any(c.isdigit() for c in v)):
        raise ValueError("a password tem de ter letras e números")
    return v


class RegistoIn(BaseModel):
    nome: str = Field(min_length=2, max_length=255)
    email: EmailStr = Field(max_length=255)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("nome")
    @classmethod
    def _nome(cls, v: str) -> str:
        v = v.strip()
        if len(v) < 2:
            raise ValueError("nome demasiado curto")
        return v

    @field_validator("password")
    @classmethod
    def _password(cls, v: str) -> str:
        return validar_password(v)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=128)
    codigo_totp: str | None = Field(default=None, max_length=6)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class UtilizadorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    email: str
    perfil: str
    ativo: bool
    totp_ativo: bool
    data_registo: datetime


class TotpConfigOut(BaseModel):
    segredo: str
    uri: str


class TotpCodigoIn(BaseModel):
    codigo: str = Field(min_length=6, max_length=6)


class PasswordAlterarIn(BaseModel):
    password_atual: str = Field(max_length=128)
    nova_password: str = Field(min_length=8, max_length=128)

    @field_validator("nova_password")
    @classmethod
    def _nova(cls, v: str) -> str:
        return validar_password(v)


class PasswordRedefinirIn(BaseModel):
    """Recuperação: indicar UM dos códigos (o do admin ou o da app autenticadora)."""
    email: EmailStr
    nova_password: str = Field(min_length=8, max_length=128)
    codigo_reset: str | None = Field(default=None, max_length=20)
    codigo_totp: str | None = Field(default=None, max_length=6)

    @field_validator("nova_password")
    @classmethod
    def _nova(cls, v: str) -> str:
        return validar_password(v)


class CodigoResetOut(BaseModel):
    codigo: str
    expira_em_minutos: int


class UtilizadorAtualizarIn(BaseModel):
    perfil: Literal["eleitor", "administrador"] | None = None
    ativo: bool | None = None
