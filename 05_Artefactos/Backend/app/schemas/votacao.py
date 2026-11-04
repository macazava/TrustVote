"""Esquemas de validação da votação, dos resultados e do resumo público."""

from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class VotoPedido(BaseModel):
    """Dados recebidos em POST /eleicoes/{id}/rondas/{numero}/votos.

    Um voto em branco tem de ser pedido de forma explícita (`branco: true`),
    para um pedido sem candidato por engano não contar como branco.
    """

    candidato_id: int | None = Field(default=None, gt=0)
    branco: bool = False

    @model_validator(mode="after")
    def _um_ou_outro(self):
        if self.branco == (self.candidato_id is not None):
            raise ValueError("Indique um candidato ou um voto em branco.")
        return self


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
    estado: str
    # True quando os números vêm do apuramento guardado (ronda encerrada).
    apurada: bool
    candidatos: list[ResultadoCandidato]
    brancos: int
    percentagem_brancos: float
    # Votos com selo de integridade inválido: não contam.
    invalidos: int
    votantes: int
    habilitados: int
    participacao: float
    quorum: float
    quorum_atingido: bool


class IntegridadeRonda(BaseModel):
    ronda: int
    votos: int
    participacoes: int
    selos_invalidos: int
    # Tantos votos na urna como eleitores que votaram.
    coincide: bool


class IntegridadeEleicao(BaseModel):
    valida: bool
    rondas: list[IntegridadeRonda]


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
    # Quando os resultados ficaram apurados (None se ainda não foram).
    apurada_em: datetime | None


class ConfiguracaoPublica(BaseModel):
    """Regras da plataforma mostradas nas páginas públicas e na área da equipa."""

    sessao_minutos: int
    login_tentativas: int
    login_bloqueio_minutos: int
    apuramento: str


class ResumoPublico(BaseModel):
    """Dados mostrados sem sessão: nunca inclui votos por candidato."""

    eleicao: ResumoEleicao
    eleitores: int
    votos: int
    participacao: float
    candidatos: list[ResumoCandidato]
