"""Esquemas de validação das rondas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RondaCriar(BaseModel):
    """Dados recebidos em POST /rondas."""

    eleicao_id: int = Field(gt=0)
    # O esquema da BD só admite 1.ª e 2.ª volta (ron_ck_numero).
    numero: int = Field(ge=1, le=2)
    data_inicio: datetime
    data_fim: datetime


class RondaResposta(BaseModel):
    """Dados devolvidos pela API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    eleicao_id: int
    numero: int
    data_inicio: datetime
    data_fim: datetime
    estado: str
