"""Sondagem (simulação académica, separador "Sondagem IA" do eleitor).

Não tem nada a ver com o voto: é uma pergunta "se a eleição fosse hoje?" de resposta anónima.
As respostas ficam no Redis só como contagens por candidato (nunca quem escolheu o quê); um
conjunto separado guarda apenas QUEM já respondeu, para cada pessoa responder uma vez.

Modelo: média bayesiana (suavização de Laplace) — cada candidato começa com 1 resposta
"virtual", o que evita 0% / 100% com amostras pequenas. O intervalo é a margem de erro de
95% de uma proporção (pior caso p = 0,5): 1,96 * sqrt(0,25 / n).
"""
import math

import redis
from sqlalchemy.orm import Session

from app.models import Eleicao, Utilizador
from app.redis_client import chave, get_redis
from app.services import eleicao as servico_eleicao
from app.services.erros import Conflito, DadosInvalidos, ServicoIndisponivel

MODELO = "TrustVote v1 · média bayesiana"
PRIOR = 1


def _candidatos(eleicao: Eleicao):
    ronda = eleicao.ronda_atual()
    if ronda is not None and ronda.candidatos:
        return ronda.candidatos
    return [c for c in eleicao.candidatos if c.ativo]


def obter(db: Session, utilizador: Utilizador, eleicao_id: int) -> dict:
    eleicao = servico_eleicao.obter_visivel(db, utilizador, eleicao_id)
    candidatos = _candidatos(eleicao)
    try:
        contagens = get_redis().hgetall(chave("sondagem", eleicao.id))
    except redis.RedisError as e:
        raise ServicoIndisponivel("Sondagem indisponível (Redis)") from e
    respostas = {c.id: int(contagens.get(str(c.id), 0)) for c in candidatos}
    amostra = sum(respostas.values())
    denominador = amostra + PRIOR * len(candidatos)
    projecao = sorted(({"candidato_id": c.id, "nome": c.nome,
                        "percentagem": round((respostas[c.id] + PRIOR) * 100 / denominador, 1) if denominador else 0.0}
                       for c in candidatos), key=lambda p: -p["percentagem"])
    intervalo = round(1.96 * math.sqrt(0.25 / amostra) * 100, 1) if amostra else None
    return {"modelo": MODELO, "amostra": amostra, "intervalo": intervalo, "projecao": projecao}


def responder(db: Session, utilizador: Utilizador, eleicao_id: int, candidato_id: int) -> dict:
    eleicao = servico_eleicao.obter_visivel(db, utilizador, eleicao_id)
    if candidato_id not in {c.id for c in _candidatos(eleicao)}:
        raise DadosInvalidos("Esse candidato não faz parte desta eleição")
    try:
        r = get_redis()
        if not r.sadd(chave("sondagem", eleicao.id, "responderam"), utilizador.id):
            raise Conflito("Já respondeu a esta sondagem")
        r.hincrby(chave("sondagem", eleicao.id), str(candidato_id), 1)
        amostra = sum(int(v) for v in r.hvals(chave("sondagem", eleicao.id)))
    except redis.RedisError as e:
        raise ServicoIndisponivel("Sondagem indisponível (Redis)") from e
    return {"amostra": amostra}
