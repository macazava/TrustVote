"""Esquemas de validação dos candidatos."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


ORGAOS = ("direcao", "assembleia", "conselho_fiscal")
Orgao = Literal["direcao", "assembleia", "conselho_fiscal"]


class CandidatoCriar(BaseModel):
    """Dados recebidos em POST /candidatos."""

    eleicao_id: int = Field(gt=0)
    nome: str = Field(min_length=1, max_length=255)
    orgao: Orgao = Field(default="direcao")
    curso: str | None = Field(default=None, max_length=150)
    ano: int | None = Field(default=None, ge=1, le=6)
    descricao: str | None = Field(default=None, max_length=5000)


class CandidatoResposta(BaseModel):
    """Dados devolvidos pela API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    eleicao_id: int
    nome: str
    orgao: str
    curso: str | None
    ano: int | None
    descricao: str | None
    ativo: bool
