"""Esquemas de validação das eleições."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.schemas.candidato import CandidatoResposta
from app.schemas.ronda import RondaDetalhe


class EleicaoCriar(BaseModel):
    """Dados recebidos em POST /eleicoes."""

    titulo: str = Field(min_length=3, max_length=150)
    descricao: str | None = Field(default=None, max_length=5000)
    # Participação mínima (% dos habilitados) para o resultado ser válido; 0 = sem quórum.
    quorum: float = Field(default=0, ge=0, le=100)


class EleicaoAlterar(BaseModel):
    """Dados recebidos em PATCH /eleicoes/{id}."""

    titulo: str | None = Field(default=None, min_length=3, max_length=150)
    descricao: str | None = Field(default=None, max_length=5000)
    quorum: float | None = Field(default=None, ge=0, le=100)

    @field_validator("titulo", "quorum")
    @classmethod
    def _sem_nulos(cls, valor):
        """Estes campos podem faltar no pedido, mas não ser limpos."""
        if valor is None:
            raise ValueError("Este campo não pode ficar vazio.")
        return valor


class EleicaoResposta(BaseModel):
    """Dados devolvidos pela API."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    descricao: str | None
    estado: str
    criador_id: int
    criada_em: datetime
    quorum: float

    @computed_field
    @property
    def data_criacao(self) -> datetime:
        return self.criada_em


class EleicaoDetalhe(EleicaoResposta):
    """Eleição com tudo o que os ecrãs de detalhe precisam."""

    candidatos: list[CandidatoResposta]
    rondas: list[RondaDetalhe]
