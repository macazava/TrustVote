from datetime import datetime

from pydantic import AwareDatetime, BaseModel, ConfigDict, Field, model_validator


class EleicaoCriarIn(BaseModel):
    titulo: str = Field(min_length=3, max_length=150)
    descricao: str | None = Field(default=None, max_length=5000)


class EleicaoAtualizarIn(BaseModel):
    titulo: str | None = Field(default=None, min_length=3, max_length=150)
    descricao: str | None = Field(default=None, max_length=5000)


class CandidatoIn(BaseModel):
    nome: str = Field(min_length=2, max_length=255)
    partido: str | None = Field(default=None, max_length=255)
    descricao: str | None = Field(default=None, max_length=5000)


class CandidatoAtualizarIn(BaseModel):
    nome: str | None = Field(default=None, min_length=2, max_length=255)
    partido: str | None = Field(default=None, max_length=255)
    descricao: str | None = Field(default=None, max_length=5000)
    ativo: bool | None = None


class CandidatoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    nome: str
    partido: str | None
    descricao: str | None
    ativo: bool


class RondaIn(BaseModel):
    # datas com fuso horário obrigatório (ex.: 2026-11-01T09:00:00+00:00)
    data_inicio: AwareDatetime
    data_fim: AwareDatetime
    # Só para a 2.ª volta: os candidatos que passam (exatamente 2)
    candidato_ids: list[int] | None = None

    @model_validator(mode="after")
    def _periodo(self):
        if self.data_fim <= self.data_inicio:
            raise ValueError("data_fim tem de ser posterior a data_inicio")
        return self


class RondaAtualizarIn(BaseModel):
    data_inicio: AwareDatetime | None = None
    data_fim: AwareDatetime | None = None


class RondaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    numero: int
    data_inicio: datetime
    data_fim: datetime
    estado: str
    candidatos: list[CandidatoOut]


class EleicaoOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    titulo: str
    descricao: str | None
    estado: str
    criador_id: int
    data_criacao: datetime


class EleicaoDetalheOut(EleicaoOut):
    rondas: list[RondaOut]
    candidatos: list[CandidatoOut]


class HabilitacaoIn(BaseModel):
    utilizador_ids: list[int] = Field(min_length=1, max_length=1000)


class HabilitadoOut(BaseModel):
    utilizador_id: int
    nome: str
    email: str
    data: datetime


class HabilitacaoResultadoOut(BaseModel):
    adicionados: int
    ja_habilitados: int
