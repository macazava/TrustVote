"""Esquemas da auditoria."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict


class AuditoriaResposta(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    data: datetime
    acao: str
    entidade: str | None
    entidade_id: int | None
    utilizador_id: int | None
    detalhes: dict | None
    ip: str | None
    hash_atual: str | None


class VerificacaoCadeia(BaseModel):
    """Resultado de recalcular a cadeia de hashes da auditoria."""

    valida: bool
    total: int
    # Primeiro registo que não bate certo (alterado, ou com um anterior apagado).
    primeiro_invalido: int | None
