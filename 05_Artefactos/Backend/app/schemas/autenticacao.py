"""Esquemas de validação dos pedidos de autenticação."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

# Validação simples, sem dependências extra (o projeto não usa email-validator).
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"
NOME_UTILIZADOR_PATTERN = r"^[A-Za-z0-9_.-]+$"


class UtilizadorCriar(BaseModel):
    """Dados recebidos em POST /auth/register."""

    nome_utilizador: str = Field(
        min_length=3, max_length=50, pattern=NOME_UTILIZADOR_PATTERN
    )
    email: str = Field(min_length=5, max_length=255, pattern=EMAIL_PATTERN)
    password: str = Field(min_length=8, max_length=128)


class UtilizadorResposta(BaseModel):
    """Dados devolvidos pela API; nunca inclui a password nem o seu hash."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    nome_utilizador: str
    email: str
    criado_em: datetime
