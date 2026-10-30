"""Esquemas de validação das eleições."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field

from app.schemas.candidato import CandidatoResposta
from app.schemas.ronda import RondaDetalhe


class EleicaoCriar(BaseModel):
    """Dados recebidos em POST /eleicoes."""

    titulo: str = Field(min_length=3, max_length=150)
    descricao: str | None = Field(default=None, max_length=5000)


class EleicaoAlterar(BaseModel):
    """Dados recebidos em PATCH /eleicoes/{id}."""

    titulo: str | None = Field(default=None, min_length=3, max_length=150)
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

    @computed_field
    @property
    def data_criacao(self) -> datetime:
        return self.criada_em


class EleicaoDetalhe(EleicaoResposta):
    """Eleição com tudo o que os ecrãs de detalhe precisam."""

    candidatos: list[CandidatoResposta]
    rondas: list[RondaDetalhe]
