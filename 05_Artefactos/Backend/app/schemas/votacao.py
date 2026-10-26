import uuid
from datetime import datetime
from decimal import Decimal
from typing import Literal

from pydantic import BaseModel, ConfigDict


class VotoIn(BaseModel):
    candidato_id: int


class ReciboOut(BaseModel):
    """O recibo (voto_id) permite ao eleitor confirmar mais tarde que o voto foi contado,
    sem revelar o candidato a ninguém."""
    recibo: uuid.UUID
    eleicao_id: int
    ronda: int
    mensagem: str = "Voto registado. Guarde o recibo para confirmar que o seu voto foi contado."


class ParticipacaoRondaOut(BaseModel):
    ronda: int
    estado: str
    votou: bool
    data: datetime | None


class VerificacaoReciboOut(BaseModel):
    registado: bool
    integro: bool | None
    eleicao_id: int | None
    ronda: int | None


class ApuramentoOut(BaseModel):
    eleicao_id: int
    ronda: int
    votos_validos: int
    votos_invalidos: int
    participacoes: int
    consistente: bool


class LinhaResultadoOut(BaseModel):
    candidato_id: int
    nome: str
    partido: str | None
    votos: int
    percentagem: Decimal


class DecisaoOut(BaseModel):
    tipo: Literal["vencedor", "segunda_volta", "empate", "sem_votos"]
    candidatos: list[int]


class ResultadoRondaOut(BaseModel):
    ronda: int
    estado: str
    apurada: bool
    total_votos: int | None = None
    candidatos: list[LinhaResultadoOut] | None = None
    decisao: DecisaoOut | None = None


class ResultadosOut(BaseModel):
    eleicao_id: int
    titulo: str
    estado: str
    rondas: list[ResultadoRondaOut]


class EstatisticaRondaOut(BaseModel):
    ronda: int
    estado: str
    votantes: int
    taxa_participacao: Decimal


class EstatisticasOut(BaseModel):
    eleicao_id: int
    habilitados: int
    rondas: list[EstatisticaRondaOut]


class AuditoriaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    data: datetime
    acao: str
    utilizador_id: int | None
    entidade: str | None
    entidade_id: int | None
    detalhes: dict | None
    ip: str | None
    hash_atual: str | None


class VerificacaoAuditoriaOut(BaseModel):
    integra: bool
    total: int
    sem_encadeamento: int  # registos antigos, anteriores à cadeia de hashes
    primeiro_registo_invalido: int | None
