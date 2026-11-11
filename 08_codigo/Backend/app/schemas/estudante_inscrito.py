"""Esquemas da lista oficial de estudantes."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.autenticacao import NUM_ESTUDANTE_PATTERN


class EstudanteNovo(BaseModel):
    num_estudante: str = Field(pattern=NUM_ESTUDANTE_PATTERN)
    nome: str | None = Field(default=None, max_length=255)
    curso: str | None = Field(default=None, max_length=150)


class EstudantesLote(BaseModel):
    """Dados recebidos em POST /estudantes-inscritos."""

    estudantes: list[EstudanteNovo] = Field(max_length=10000)


class EstudantesLoteResposta(BaseModel):
    adicionados: int
    ja_existiam: int


class EstudanteResposta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    num_estudante: str
    nome: str | None
    curso: str | None
    inscrito_em: datetime
    # Se já existe uma conta com este número.
    registado: bool = False


class ListaInscritos(BaseModel):
    # Com `restrito` a False, qualquer número pode criar conta (a lista é só informativa).
    restrito: bool
    estudantes: list[EstudanteResposta]
