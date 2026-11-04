"""Redis em baixo: a API deixa de o tentar depois da primeira falha."""

import redis

from app import cache


class RedisEmBaixo:
    def __init__(self):
        self.tentativas = 0

    def exists(self, _chave):
        self.tentativas += 1
        raise redis.ConnectionError("sem Redis")

    def ping(self):
        raise redis.ConnectionError("sem Redis")


def teste_disjuntor(monkeypatch):
    falso = RedisEmBaixo()
    monkeypatch.setattr(cache, "_cliente", falso)
    monkeypatch.setattr(cache, "INTERVALO_VIGIA", 3600)
    monkeypatch.setattr(cache, "_ligado", cache.threading.Event())
    cache._ligado.set()

    assert cache.token_revogado("abc") is False  # falha: segue sem Redis
    assert cache.token_revogado("abc") is False
    assert cache.disponivel() is False
    assert falso.tentativas == 1  # só o primeiro pedido esperou pelo Redis
