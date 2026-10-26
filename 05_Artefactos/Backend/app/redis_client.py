"""Ligação ao Redis, partilhado pelas duas instâncias do backend.

Usado para estado temporário que tem de ser igual nas duas instâncias: limite de tentativas
de login, códigos de reposição de password e revogação de tokens (logout). Não guarda dados
eleitorais: a fonte de verdade é sempre o PostgreSQL.
"""
from functools import lru_cache

import redis

from app.config import get_settings


@lru_cache
def get_redis() -> redis.Redis:
    s = get_settings()
    return redis.Redis(host=s.redis_host, port=s.redis_port, password=s.redis_password,
                       decode_responses=True, socket_timeout=2, socket_connect_timeout=2)


def chave(*partes: object) -> str:
    """Todas as chaves começam pelo prefixo configurado (os testes usam um prefixo próprio)."""
    return get_settings().redis_prefixo + ":".join(str(p) for p in partes)
