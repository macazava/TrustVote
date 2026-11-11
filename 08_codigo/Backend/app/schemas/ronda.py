"""Esquemas de validação das rondas."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.candidato import CandidatoResposta


class RondaCriar(BaseModel):
    """Dados recebidos em POST /rondas."""

    eleicao_id: int = Field(gt=0)
    # O esquema da BD só admite 1.ª e 2.ª volta (ron_ck_numero).
    numero: int = Field(ge=1, le=2)
    data_inicio: datetime
    data_fim: datetime


class RondaDatas(BaseModel):
    """Dados recebidos em PATCH /eleicoes/{id}/rondas/{numero}."""

    data_inicio: datetime
    data_fim: datetime


class RondaNova(RondaDatas):
    """Dados recebidos em POST /eleicoes/{id}/rondas; o número é atribuído pela API."""

    # Obrigatório na 2.ª volta: os dois candidatos que passam.
    candidato_ids: list[int] | None = None


class RondaResposta(BaseModel):
    """Dados devolvidos pela API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    eleicao_id: int
    numero: int
    data_inicio: datetime
    data_fim: datetime
    estado: str


class RondaDetalhe(RondaResposta):
    """Ronda com os candidatos que nela concorrem."""

    candidatos: list[CandidatoResposta]
