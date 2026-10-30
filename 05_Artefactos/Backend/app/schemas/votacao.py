import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class VotoIn(BaseModel):
    candidato_id: int


class ReciboOut(BaseModel):
    """O recibo (voto_id) permite ao eleitor confirmar mais tarde que o voto foi contado,
    sem revelar o candidato a ninguém. O hash é o HMAC do voto (sem a chave não revela o candidato)."""
    recibo: uuid.UUID
    hash: str
    data: datetime
    eleicao_id: int
    ronda: int
    mensagem: str = "Voto registado. Guarde o recibo para confirmar que o seu voto foi contado."


class ParticipacaoRondaOut(BaseModel):
    ronda: int
    estado: str
    votou: bool
    data: datetime | None


class ParticipacaoOut(BaseModel):
    """votou: se o eleitor já votou na ronda atual (a aberta, senão a agendada, senão a última)."""
    votou: bool
    ronda: int | None
    rondas: list[ParticipacaoRondaOut]


class VerificacaoReciboOut(BaseModel):
    registado: bool
    integro: bool | None
    eleicao_id: int | None
    ronda: int | None


class VerificacaoReciboFrontOut(VerificacaoReciboOut):
    """Formato usado pelo frontend: valido = registado e não alterado; incluido = conta no apuramento."""
    valido: bool
    incluido: bool


class ApuramentoOut(BaseModel):
    eleicao_id: int
    ronda: int
    votos_validos: int
    votos_invalidos: int
    participacoes: int
    consistente: bool


class LinhaResultadoOut(BaseModel):
    id: int
    nome: str
    partido: str | None
    total_votos: int
    percentagem: float


class DecisaoOut(BaseModel):
    tipo: Literal["vencedor", "segunda_volta", "empate", "sem_votos"]
    candidatos: list[int]


class ResultadoRondaOut(BaseModel):
    """Uma ronda com contagem. provisorio=True: ronda ainda não apurada (só os admins a veem)."""
    ronda: int
    estado: str
    apurada: bool
    provisorio: bool
    total_votos: int
    candidatos: list[LinhaResultadoOut]
    decisao: DecisaoOut | None = None


class PontoSerieOut(BaseModel):
    hora: datetime
    votos: int


class EstatisticaRondaOut(BaseModel):
    ronda: int
    estado: str
    votantes: int
    taxa_participacao: float


class EstatisticasOut(BaseModel):
    """habilitados/votantes/participacao/serie referem-se à ronda atual; rondas tem o detalhe de todas."""
    eleicao_id: int
    habilitados: int
    ronda: int | None
    votantes: int
    participacao: float
    serie: list[PontoSerieOut]
    rondas: list[EstatisticaRondaOut]


class CandidatoPublicoOut(BaseModel):
    id: int
    nome: str
    partido: str | None
    descricao: str | None


class EleicaoPublicaOut(BaseModel):
    id: int
    titulo: str
    estado: str
    data_inicio: datetime | None
    data_fim: datetime | None


class ResumoPublicoOut(BaseModel):
    eleicao: EleicaoPublicaOut | None
    eleitores: int
    votos: int
    participacao: float
    candidatos: list[CandidatoPublicoOut]


class ProjecaoOut(BaseModel):
    candidato_id: int | None
    nome: str
    percentagem: float


class SondagemOut(BaseModel):
    modelo: str
    amostra: int
    intervalo: float | None
    projecao: list[ProjecaoOut]


class SondagemRespostaIn(BaseModel):
    candidato_id: int


class SondagemRespostaOut(BaseModel):
    amostra: int


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
