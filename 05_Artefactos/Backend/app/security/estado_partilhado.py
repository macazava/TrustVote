"""Estado de segurança partilhado pelas duas instâncias, guardado no Redis.

- Limite de tentativas de login falhadas por email (proteção contra força bruta).
- Revogação de tokens: logout (um token) e "terminar todas as sessões" (após mudar a password).
- Códigos de reposição de password emitidos por um administrador.

Se o Redis estiver em baixo, o limite de logins e a verificação de revogação deixam passar
(fail-open, registado no log) para a votação não parar por causa de um serviço auxiliar; os
códigos de reposição precisam do Redis e devolvem 503.
"""
import hashlib
import hmac
import logging
import secrets
import time

import redis

from app.config import get_settings
from app.redis_client import chave, get_redis
from app.services.erros import ServicoIndisponivel

log = logging.getLogger("trustvote.seguranca")


# ------------------------------------------------------------------ limite de logins

def _chave_falhas(email: str) -> str:
    return chave("login_falhas", email.lower())


def login_bloqueado(email: str) -> bool:
    try:
        falhas = get_redis().get(_chave_falhas(email))
    except redis.RedisError as e:
        log.warning("Redis indisponível no limite de login: %s", e)
        return False
    return falhas is not None and int(falhas) >= get_settings().login_max_tentativas


def registar_falha_login(email: str) -> None:
    try:
        r, k = get_redis(), _chave_falhas(email)
        if r.incr(k) == 1:
            r.expire(k, get_settings().login_janela_segundos)
    except redis.RedisError as e:
        log.warning("Redis indisponível ao registar falha de login: %s", e)


def limpar_falhas_login(email: str) -> None:
    try:
        get_redis().delete(_chave_falhas(email))
    except redis.RedisError:
        pass


# ------------------------------------------------------------------ revogação de tokens

def revogar_token(jti: str, expira_em: int) -> None:
    """Logout: o token deixa de ser aceite até expirar (depois disso já não importa)."""
    ttl = max(1, expira_em - int(time.time()))
    try:
        get_redis().set(chave("token_revogado", jti), "1", ex=ttl)
    except redis.RedisError as e:
        raise ServicoIndisponivel("Não foi possível terminar a sessão (Redis indisponível)") from e


def revogar_todos(utilizador_id: int) -> None:
    """Invalida todos os tokens emitidos até agora para o utilizador (ex.: após mudar a password)."""
    agora_ms = int(time.time() * 1000)
    try:
        get_redis().set(chave("revogados_ate", utilizador_id), agora_ms,
                        ex=get_settings().jwt_minutos * 60 + 60)
    except redis.RedisError as e:
        log.warning("Redis indisponível ao revogar tokens de %s: %s", utilizador_id, e)


def token_revogado(jti: str | None, utilizador_id: int, emitido_ms: int | None) -> bool:
    try:
        r = get_redis()
        if jti and r.exists(chave("token_revogado", jti)):
            return True
        ate = r.get(chave("revogados_ate", utilizador_id))
    except redis.RedisError as e:
        log.warning("Redis indisponível na verificação de revogação: %s", e)
        return False
    return ate is not None and (emitido_ms or 0) <= int(ate)


# ------------------------------------------------------------------ códigos de reposição

def _hash_codigo(codigo: str) -> str:
    return hashlib.sha256(codigo.encode()).hexdigest()


def criar_codigo_reset(utilizador_id: int) -> str:
    """Código de uso único, válido RESET_CODIGO_MINUTOS. Só o hash fica guardado."""
    codigo = secrets.token_hex(5).upper()  # 10 caracteres, fácil de ditar
    try:
        get_redis().set(chave("reset", utilizador_id), _hash_codigo(codigo),
                        ex=get_settings().reset_codigo_minutos * 60)
    except redis.RedisError as e:
        raise ServicoIndisponivel("Não foi possível gerar o código (Redis indisponível)") from e
    return codigo


def consumir_codigo_reset(utilizador_id: int, codigo: str) -> bool:
    k = chave("reset", utilizador_id)
    try:
        r = get_redis()
        guardado = r.get(k)
        if guardado is None or not hmac.compare_digest(guardado, _hash_codigo(codigo.strip().upper())):
            return False
        return r.delete(k) == 1  # só o primeiro pedido consegue usar o código
    except redis.RedisError as e:
        raise ServicoIndisponivel("Não foi possível validar o código (Redis indisponível)") from e
