"""Esquemas de validação das habilitações (quem pode votar)."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class HabilitacaoCriar(BaseModel):
    """Dados recebidos em POST /habilitacoes."""

    eleicao_id: int = Field(gt=0)
    utilizador_id: int = Field(gt=0)


class HabilitacaoResposta(BaseModel):
    """Dados devolvidos pela API."""

    model_config = ConfigDict(from_attributes=True)

    eleicao_id: int
    utilizador_id: int
    registada_em: datetime
