"""Worker de apuramento: processo separado da API (serviço `worker` no compose.yaml).

A cada WORKER_INTERVALO segundos:
  1. encerra as rondas abertas cujo data_fim já passou;
  2. apura as rondas encerradas (conta os votos, verifica a integridade, grava os resultados).

Uso:  python -m app.worker            (corre para sempre)
      python -m app.worker --uma-vez  (um ciclo e termina)

Escreve um "batimento" em /tmp/worker-vivo a cada ciclo, usado pelo healthcheck do Docker.
"""
import logging
import os
import sys
import time
from pathlib import Path

from app.config import get_settings
from app.database import get_session_factory
from app.services.apuramento import ciclo_automatico

log = logging.getLogger("trustvote.worker")
BATIMENTO = Path(os.getenv("WORKER_BATIMENTO", "/tmp/worker-vivo"))


def um_ciclo() -> dict:
    with get_session_factory()() as db:
        resultado = ciclo_automatico(db)
    for eleicao_id, numero in resultado["encerradas"]:
        log.info("Ronda %s da eleição %s encerrada (fim do período)", numero, eleicao_id)
    for a in resultado["apuradas"]:
        log.info("Ronda %s da eleição %s apurada: %s votos válidos, %s inválidos, consistente=%s",
                 a["ronda"], a["eleicao_id"], a["votos_validos"], a["votos_invalidos"], a["consistente"])
    return resultado


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    get_settings()
    intervalo = int(os.getenv("WORKER_INTERVALO", "10"))
    log.info("Worker iniciado (intervalo %ss)", intervalo)
    while True:
        try:
            um_ciclo()
            BATIMENTO.write_text(str(int(time.time())))
        except Exception:  # noqa: BLE001 — o worker não pode morrer por um erro num ciclo
            log.exception("Erro no ciclo do worker")
        if "--uma-vez" in sys.argv:
            return
        time.sleep(intervalo)


if __name__ == "__main__":
    main()
