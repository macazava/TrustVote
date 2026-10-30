"""Esquemas de validação dos candidatos."""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


ORGAOS = ("direcao", "assembleia", "conselho_fiscal")
Orgao = Literal["direcao", "assembleia", "conselho_fiscal"]


class CandidatoNovo(BaseModel):
    """Dados recebidos em POST /eleicoes/{id}/candidatos."""

    nome: str = Field(min_length=1, max_length=255)
    partido: str | None = Field(default=None, max_length=200)
    orgao: Orgao = Field(default="direcao")
    curso: str | None = Field(default=None, max_length=150)
    ano: int | None = Field(default=None, ge=1, le=6)
    descricao: str | None = Field(default=None, max_length=5000)


class CandidatoCriar(CandidatoNovo):
    """Dados recebidos em POST /candidatos."""

    eleicao_id: int = Field(gt=0)


class CandidatoAlterar(BaseModel):
    """Dados recebidos em PATCH /eleicoes/{id}/candidatos/{id}."""

    nome: str | None = Field(default=None, min_length=1, max_length=255)
    partido: str | None = Field(default=None, max_length=200)
    orgao: Orgao | None = None
    curso: str | None = Field(default=None, max_length=150)
    ano: int | None = Field(default=None, ge=1, le=6)
    descricao: str | None = Field(default=None, max_length=5000)
    ativo: bool | None = None

    @field_validator("nome", "orgao", "ativo")
    @classmethod
    def _sem_nulos(cls, valor):
        """Estes campos podem faltar no pedido, mas não ser limpos."""
        if valor is None:
            raise ValueError("Este campo não pode ficar vazio.")
        return valor


class CandidatoResposta(BaseModel):
    """Dados devolvidos pela API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    eleicao_id: int
    nome: str
    partido: str | None
    orgao: str
    curso: str | None
    ano: int | None
    descricao: str | None
    ativo: bool
