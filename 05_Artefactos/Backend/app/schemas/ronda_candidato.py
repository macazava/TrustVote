"""Esquemas de validação dos candidatos de cada ronda."""

from pydantic import BaseModel, ConfigDict, Field


class RondaCandidatoCriar(BaseModel):
    """Dados recebidos em POST /rondas-candidatos."""

    ronda_id: int = Field(gt=0)
    candidato_id: int = Field(gt=0)


class RondaCandidatoResposta(BaseModel):
    """Dados devolvidos pela API."""

    model_config = ConfigDict(from_attributes=True)

    ronda_id: int
    candidato_id: int
