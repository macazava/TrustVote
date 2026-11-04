"""Worker de apuramento (contentores `worker` e `worker-reserva`).

    python -m app.worker

Os dois workers correm ao mesmo tempo, mas só trabalha o que tiver o advisory
lock de liderança, guardado numa ligação aberta à BD. Com WORKER_PAPEL=reserva,
o worker só disputa a liderança enquanto o principal não estiver presente (o
principal segura outro lock enquanto corre) e devolve-a quando ele volta. Se o
principal parar ou perder a ligação (ex.: failover da BD), os locks ficam livres
e a reserva assume em poucos segundos.

O líder:
1. apura as voltas pedidas na fila do Redis (as instâncias da API, com
   APURAMENTO=worker, só fecham a votação);
2. a cada TAREFAS_INTERVALO segundos corre as tarefas automáticas
   (app/tarefas.py), que também apuram as voltas encerradas que ficaram por
   apurar (pedido perdido ou Redis em baixo).

O estado ("lider", "reserva" ou "sem-bd") fica em /tmp/worker-estado, para o
healthcheck e para Infraestrutura/demo/estado.py.
"""

import logging
import os
import signal
import sys
import time
from pathlib import Path

from sqlalchemy import text
from sqlalchemy.exc import SQLAlchemyError

from app import cache, tarefas
from app.database import SessionLocal, engine_sem_pool

log = logging.getLogger("trustvote.worker")

NOME = os.getenv("WORKER_NOME", "worker")
RESERVA = os.getenv("WORKER_PAPEL", "principal") == "reserva"
INTERVALO = int(os.getenv("TAREFAS_INTERVALO", "30")) or 30
# Tempo máximo à espera na fila: é também o intervalo de verificação da ligação.
ESPERA_FILA = 5
ESPERA_RESERVA = 3
_CHAVE_LIDER = 7_240_013
_CHAVE_PRINCIPAL = 7_240_014
ESTADO = Path("/tmp/worker-estado")


def _marcar(estado: str) -> None:
    try:
        ESTADO.write_text(f"{estado} {int(time.time())}\n")
    except OSError:
        pass


def _consultar(conexao, sql: str, chave: int):
    valor = conexao.scalar(text(sql), {"k": chave})
    conexao.commit()
    return valor


def _tentar(conexao, chave: int) -> bool:
    return _consultar(conexao, "SELECT pg_try_advisory_lock(:k)", chave)


def _principal_presente(conexao) -> bool:
    if not _tentar(conexao, _CHAVE_PRINCIPAL):
        return True
    _consultar(conexao, "SELECT pg_advisory_unlock(:k)", _CHAVE_PRINCIPAL)
    return False


def _liderar(conexao) -> None:
    """Trabalha enquanto a ligação estiver viva; a reserva sai quando o principal volta."""
    proximo_ciclo = 0.0
    while True:
        # Se a BD cair, isto falha e a liderança perde-se com a ligação.
        if RESERVA and _principal_presente(conexao):
            return
        conexao.execute(text("SELECT 1"))
        conexao.commit()
        _marcar("lider")

        if time.monotonic() >= proximo_ciclo:
            tarefas.executar_ciclo()
            proximo_ciclo = time.monotonic() + INTERVALO

        espera = max(1, min(ESPERA_FILA, int(proximo_ciclo - time.monotonic())))
        ronda_id = cache.esperar_apuramento(espera)
        if ronda_id is not None:
            with SessionLocal() as sessao:
                if tarefas.apurar_pendentes(sessao, [ronda_id]):
                    log.info("Volta %s apurada.", ronda_id)


def _servir(conexao) -> None:
    em_espera = False
    if not RESERVA:
        # Anuncia à reserva que o principal está a correr (dura enquanto a ligação durar).
        _tentar(conexao, _CHAVE_PRINCIPAL)
    while True:
        livre = not (RESERVA and _principal_presente(conexao))
        if livre and _tentar(conexao, _CHAVE_LIDER):
            log.info("%s assumiu o apuramento.", NOME)
            em_espera = False
            _liderar(conexao)
            _consultar(conexao, "SELECT pg_advisory_unlock(:k)", _CHAVE_LIDER)
            log.info("%s devolveu o apuramento ao worker principal.", NOME)
            continue
        if not em_espera:
            log.info("%s de reserva: outro worker está a apurar.", NOME)
            em_espera = True
        _marcar("reserva")
        time.sleep(ESPERA_RESERVA)


def correr() -> None:
    while True:
        try:
            # Ligação sem pool: ao sair daqui (erro ou paragem) fecha mesmo e liberta os locks.
            with engine_sem_pool.connect() as conexao:
                _servir(conexao)
        except SQLAlchemyError as erro:
            # Ex.: failover da BD. Volta a disputar a liderança com uma ligação nova.
            log.warning("%s sem base de dados: %s", NOME, erro.__class__.__name__)
            _marcar("sem-bd")
            time.sleep(2)
        except Exception:
            log.exception("Erro no worker.")
            time.sleep(5)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
    # PID 1 no contentor: sem isto, o `docker stop` só o termina ao fim de 10 s.
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))
    correr()


if __name__ == "__main__":
    main()
