"""Esquemas de validação das habilitações (quem pode votar)."""

from datetime import datetime

from pydantic import BaseModel


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
