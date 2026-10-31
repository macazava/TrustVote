"""Esquemas de validação da votação, dos resultados e do resumo público."""

from datetime import datetime

from pydantic import BaseModel, Field


class VotoPedido(BaseModel):
    """Dados recebidos em POST /eleicoes/{id}/rondas/{numero}/votos."""

    candidato_id: int = Field(gt=0)


class VotoResposta(BaseModel):
    """Recibo do voto: só o eleitor o fica a ter, o servidor guarda apenas o hash."""

    recibo: str
    hash: str
    data: datetime


class ParticipacaoResposta(BaseModel):
    votou: bool


class ReciboVerificacao(BaseModel):
    valido: bool
    incluido: bool
    ronda: int | None


class ResultadoCandidato(BaseModel):
    id: int
    nome: str
    total_votos: int
    percentagem: float


class ResultadoRonda(BaseModel):
    ronda: int
    candidatos: list[ResultadoCandidato]


class PontoSerie(BaseModel):
    hora: datetime
    votos: int


class Estatisticas(BaseModel):
    habilitados: int
    votantes: int
    participacao: float
    serie: list[PontoSerie]


class ResumoEleicao(BaseModel):
    id: int
    titulo: str
    estado: str
    data_inicio: datetime | None
    data_fim: datetime | None


class ResumoCandidato(BaseModel):
    id: int
    nome: str
    partido: str | None
    descricao: str | None


class HistoricoEleicao(BaseModel):
    """Eleição encerrada, para a página pública do histórico."""

    id: int
    titulo: str
    descricao: str | None
    data_inicio: datetime | None
    data_fim: datetime | None
    eleitores: int
    votos: int
    participacao: float


class ResumoPublico(BaseModel):
    """Dados mostrados sem sessão: nunca inclui votos por candidato."""

    eleicao: ResumoEleicao
    eleitores: int
    votos: int
    participacao: float
    candidatos: list[ResumoCandidato]
