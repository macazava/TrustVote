"""Esquemas de validação das eleições."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class EleicaoCriar(BaseModel):
    """Dados recebidos em POST /eleicoes."""

    titulo: str = Field(min_length=3, max_length=150)
    descricao: str | None = Field(default=None, max_length=5000)


class EleicaoResposta(BaseModel):
    """Dados devolvidos pela API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    descricao: str | None
    estado: str
    criador_id: int
    criada_em: datetime
