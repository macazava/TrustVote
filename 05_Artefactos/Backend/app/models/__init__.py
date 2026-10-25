"""Modelos ORM. Importar este pacote regista todas as tabelas no Base.metadata."""
from app.models.auditoria import Auditoria
from app.models.eleicao import Candidato, Eleicao, Habilitacao, Ronda, RondaCandidato
from app.models.utilizador import Utilizador

__all__ = ["Auditoria", "Candidato", "Eleicao", "Habilitacao", "Ronda", "RondaCandidato", "Utilizador"]
