"""Modelos ORM. Importar este pacote regista todas as tabelas no Base.metadata."""
from app.models.auditoria import Auditoria
from app.models.eleicao import Candidato, Eleicao, Habilitacao, Ronda, RondaCandidato
from app.models.utilizador import Utilizador
from app.models.votacao import Participacao, Resultado, Voto

__all__ = ["Auditoria", "Candidato", "Eleicao", "Habilitacao", "Participacao", "Resultado", "Ronda",
           "RondaCandidato", "Utilizador", "Voto"]
