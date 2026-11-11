"""Ligação ao Redis: sessões terminadas e limite de tentativas (login e envios).

No Docker há dois Redis (um em cada servidor) vigiados por três Sentinels: a API
pergunta aos Sentinels (REDIS_SENTINELS) qual é o principal, por isso continua a
funcionar quando um servidor cai e a réplica é promovida. Fora do Docker pode
ligar-se a um Redis só (REDIS_HOST). Sem nenhum dos dois, estas funções não fazem nada. Se o Redis falhar, a API
continua a funcionar: perde-se só o logout imediato e o limite de tentativas,
nunca a votação.

Com o Redis em baixo (ex.: o Servidor 1 parado), cada tentativa de ligação pode
custar segundos só no DNS. Por isso, depois da primeira falha, a API deixa de o
usar e é uma thread em segundo plano que vai experimentando até ele voltar.
"""

import logging
import os
import threading
import time

import redis
from redis.backoff import NoBackoff
from redis.retry import Retry
from redis.sentinel import Sentinel

log = logging.getLogger("trustvote.cache")

REDIS_HOST = os.getenv("REDIS_HOST", "")
REDIS_PORT = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD") or None
# "sentinel1:26379,sentinel2:26379,..." e o nome do grupo vigiado pelos Sentinels
REDIS_SENTINELS = [
    (anfitriao, int(porta))
    for anfitriao, _, porta in (s.strip().partition(":") for s in os.getenv("REDIS_SENTINELS", "").split(","))
    if anfitriao
]
REDIS_GRUPO = os.getenv("REDIS_GRUPO", "trustvote")
CONFIGURADO = bool(REDIS_SENTINELS or REDIS_HOST)

TENTATIVAS_LOGIN = int(os.getenv("LOGIN_TENTATIVAS", "5"))
JANELA_LOGIN = int(os.getenv("LOGIN_JANELA_SEGUNDOS", "900"))
INTERVALO_VIGIA = 2

# Sem repetições automáticas do cliente: uma falha responde logo.
_SEM_REPETIR = Retry(NoBackoff(), 0)

_sentinel = (
    Sentinel(
        REDIS_SENTINELS,
        socket_timeout=0.5,
        socket_connect_timeout=0.5,
        # Também sem repetições: com um Sentinel morto, as repetições por defeito do
        # redis-py prendiam um pedido ~9 s enquanto procurava o Redis principal.
        sentinel_kwargs={
            "password": REDIS_PASSWORD,
            "socket_timeout": 0.5,
            "socket_connect_timeout": 0.5,
            "retry": _SEM_REPETIR,
        },
    )
    if REDIS_SENTINELS
    else None
)


def _novo_cliente(**opcoes) -> redis.Redis | None:
    """Cliente do Redis principal: pelos Sentinels (segue o failover) ou direto."""
    opcoes.update(password=REDIS_PASSWORD, retry=_SEM_REPETIR, decode_responses=True)
    if _sentinel is not None:
        return _sentinel.master_for(REDIS_GRUPO, **opcoes)
    if REDIS_HOST:
        return redis.Redis(host=REDIS_HOST, port=REDIS_PORT, **opcoes)
    return None


_cliente = _novo_cliente(socket_timeout=0.5, socket_connect_timeout=0.5)

# Disjuntor: enquanto estiver "em baixo", os pedidos não tentam o Redis.
_ligado = threading.Event()
_ligado.set()
_vigia = threading.Lock()


def _vigiar() -> None:
    while True:
        time.sleep(INTERVALO_VIGIA)
        try:
            _cliente.ping()
        except redis.RedisError:
            continue
        log.warning("Redis de volta.")
        _ligado.set()
        return


def _marcar_em_baixo(erro: Exception) -> None:
    with _vigia:
        if not _ligado.is_set():
            return
        _ligado.clear()
    log.warning("Redis indisponível: %s", erro)
    threading.Thread(target=_vigiar, name="vigia-redis", daemon=True).start()


def _executar(operacao, omissao=None):
    if _cliente is None or not _ligado.is_set():
        return omissao
    try:
        return operacao(_cliente)
    except redis.RedisError as erro:
        _marcar_em_baixo(erro)
        return omissao


def disponivel() -> bool:
    return bool(_executar(lambda r: r.ping(), False))


# ===== Sessões terminadas (logout) =====
def revogar_token(jti: str, segundos: int) -> None:
    """Guarda o token até expirar, para deixar de ser aceite."""
    if segundos > 0:
        _executar(lambda r: r.set(f"tv:revogado:{jti}", "1", ex=segundos))


def token_revogado(jti: str) -> bool:
    return bool(_executar(lambda r: r.exists(f"tv:revogado:{jti}"), False))


# ===== Tentativas de login =====
def _chave_login(email: str) -> str:
    return f"tv:login:{email.strip().lower()}"


def login_bloqueado(email: str) -> bool:
    falhas = _executar(lambda r: r.get(_chave_login(email)))
    return falhas is not None and int(falhas) >= TENTATIVAS_LOGIN


def registar_falha_login(email: str) -> None:
    def operacao(r):
        chave = _chave_login(email)
        with r.pipeline() as p:
            p.incr(chave)
            p.expire(chave, JANELA_LOGIN, nx=True)
            p.execute()

    _executar(operacao)


def limpar_falhas_login(email: str) -> None:
    _executar(lambda r: r.delete(_chave_login(email)))


# ===== Limite de envios (ex.: formulário de contacto) =====
def contar_envio(nome: str, janela: int) -> int:
    """Conta mais um envio na janela (segundos) e devolve o total. Sem Redis devolve 0 (não limita)."""

    def operacao(r):
        chave = f"tv:limite:{nome}"
        with r.pipeline() as p:
            p.incr(chave)
            p.expire(chave, janela, nx=True)
            return p.execute()[0]

    return int(_executar(operacao, 0) or 0)

