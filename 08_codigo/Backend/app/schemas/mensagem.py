"""Esquemas das mensagens do formulário de contacto."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.autenticacao import EMAIL_PATTERN


class MensagemNova(BaseModel):
    """Dados recebidos em POST /contactos (página Ajuda → Contactos)."""

    nome: str = Field(min_length=2, max_length=80)
    email: str = Field(min_length=5, max_length=255, pattern=EMAIL_PATTERN)
    assunto: str = Field(min_length=2, max_length=80)
    mensagem: str = Field(min_length=10, max_length=1500)


class MensagemResposta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    email: str
    assunto: str
    mensagem: str
    lida: bool
    data: datetime


class MensagemEstado(BaseModel):
    """PATCH /contactos/{id}: marcar como lida ou por ler."""

    lida: bool
