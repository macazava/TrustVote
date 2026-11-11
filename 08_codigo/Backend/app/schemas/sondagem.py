"""Esquemas da sondagem."""

from pydantic import BaseModel, Field


class SondagemPedido(BaseModel):
    """Dados recebidos em POST /eleicoes/{id}/sondagem/respostas."""

    candidato_id: int = Field(gt=0)


class ProjecaoCandidato(BaseModel):
    candidato_id: int
    nome: str
    percentagem: float


class SondagemResposta(BaseModel):
    modelo: str
    # Número de respostas recebidas.
    amostra: int
    # Margem de erro a 95%, em pontos percentuais.
    intervalo: float
    projecao: list[ProjecaoCandidato]
    respondeu: bool
