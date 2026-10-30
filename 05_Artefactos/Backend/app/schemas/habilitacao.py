"""Esquemas de validação das habilitações (quem pode votar)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HabilitacaoCriar(BaseModel):
    """Dados recebidos em POST /habilitacoes."""

    eleicao_id: int = Field(gt=0)
    utilizador_id: int = Field(gt=0)


class HabilitacaoLote(BaseModel):
    """Dados recebidos em POST /eleicoes/{id}/habilitados."""

    utilizador_ids: list[int]


class HabilitacaoLoteResposta(BaseModel):
    adicionados: int
    ja_habilitados: int


class HabilitadoResposta(BaseModel):
    """Linha do caderno eleitoral."""

    utilizador_id: int
    nome: str
    email: str
    data: datetime


class HabilitacaoResposta(BaseModel):
    """Dados devolvidos pela API."""

    model_config = ConfigDict(from_attributes=True)

    eleicao_id: int
    utilizador_id: int
    registada_em: datetime
