"""Esquemas de validação dos candidatos."""

from pydantic import BaseModel, ConfigDict, Field


class CandidatoCriar(BaseModel):
    """Dados recebidos em POST /candidatos."""

    eleicao_id: int = Field(gt=0)
    nome: str = Field(min_length=1, max_length=255)
    partido: str | None = Field(default=None, max_length=255)
    descricao: str | None = Field(default=None, max_length=5000)


class CandidatoResposta(BaseModel):
    """Dados devolvidos pela API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    eleicao_id: int
    nome: str
    partido: str | None
    descricao: str | None
    ativo: bool
