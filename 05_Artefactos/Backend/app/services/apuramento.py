"""Apuramento (RF09/RF10): contagem dos votos com verificação dos selos.

Só contam os votos com selo de integridade válido (app/security/integridade.py).
As percentagens dos candidatos são sobre os votos em candidatos; a dos votos em
branco é sobre o total de votos válidos.

Ao encerrar uma ronda, a contagem fica guardada na tabela `resultado` e a ronda
passa a 'apurada'; a partir daí os resultados são lidos dessa tabela.

Por omissão, o apuramento é feito no próprio pedido que encerra a volta. Com
APURAMENTO=worker, quem encerra só fecha a votação ('encerrada') e as tarefas
automáticas (app/tarefas.py) apuram-na no ciclo seguinte.
"""

import os
from collections import Counter
from dataclasses import dataclass, field

from sqlalchemy.orm import Session

from app.models.resultado import Resultado
from app.models.ronda import Ronda
from app.repositories import ronda_candidato as repositorio_ronda_candidato
from app.repositories import votacao as repositorio
from app.security.integridade import selo_valido

NO_WORKER = os.getenv("APURAMENTO", "imediato") == "worker"


@dataclass
class Contagem:
    por_candidato: dict[int, int] = field(default_factory=dict)
    brancos: int = 0
    # Votos com o selo errado ou em falta: alterados ou inseridos fora da API.
    invalidos: int = 0

    @property
    def em_candidatos(self) -> int:
        return sum(self.por_candidato.values())

    @property
    def validos(self) -> int:
        return self.em_candidatos + self.brancos


def percentagem(parte: int, total: int) -> float:
    return round(parte / total * 100, 1) if total else 0.0


def contar(sessao: Session, ronda: Ronda) -> Contagem:
    """Conta os votos da urna, verificando o selo de cada um."""
    contagem = Contagem()
    por_candidato: Counter[int] = Counter()
    for voto in repositorio.listar_votos(sessao, ronda.id):
        if not selo_valido(voto):
            contagem.invalidos += 1
        elif voto.candidato_id is None:
            contagem.brancos += 1
        else:
            por_candidato[voto.candidato_id] += 1
    contagem.por_candidato = dict(por_candidato)
    return contagem


def ler_apurado(sessao: Session, ronda: Ronda) -> Contagem:
    """A contagem guardada no apuramento da ronda."""
    contagem = Contagem()
    for linha in repositorio.listar_resultados(sessao, ronda.id):
        if linha.candidato_id is None:
            contagem.brancos = linha.total_votos
        else:
            contagem.por_candidato[linha.candidato_id] = linha.total_votos
    # O que está na urna e não entrou no apuramento foram os votos sem selo válido.
    contagem.invalidos = max(
        0, repositorio.contar_votos_na_urna(sessao, ronda.id) - contagem.validos
    )
    return contagem


def contagem_da_ronda(sessao: Session, ronda: Ronda) -> Contagem:
    return ler_apurado(sessao, ronda) if ronda.estado == "apurada" else contar(sessao, ronda)


def apurar_ronda(sessao: Session, ronda: Ronda) -> Contagem:
    """Guarda a contagem na tabela `resultado` e marca a ronda como 'apurada'.

    Não faz commit: fica na mesma transação de quem encerra a ronda. Os votos são
    regravados por ordem aleatória, para a ordem de chegada não ficar na tabela.
    """
    repositorio.baralhar_votos(sessao, ronda.id)
    contagem = contar(sessao, ronda)
    candidatos = repositorio_ronda_candidato.listar_candidatos(sessao, ronda.id)
    linhas = [
        Resultado(
            ronda_id=ronda.id,
            candidato_id=candidato.id,
            total_votos=contagem.por_candidato.get(candidato.id, 0),
            percentagem=percentagem(
                contagem.por_candidato.get(candidato.id, 0), contagem.em_candidatos
            ),
        )
        for candidato in candidatos
    ]
    linhas.append(
        Resultado(
            ronda_id=ronda.id,
            candidato_id=None,
            total_votos=contagem.brancos,
            percentagem=percentagem(contagem.brancos, contagem.validos),
        )
    )
    repositorio.substituir_resultados(sessao, ronda.id, linhas)
    ronda.estado = "apurada"
    return contagem
