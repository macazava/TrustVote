"""Monitor de failover do PostgreSQL.

Vigia os dois nós pela rede e mantém estas regras:

- Com réplica ativa, a replicação é síncrona: um voto só é confirmado depois de
  estar nas duas bases de dados.
- Sem réplica, passa a assíncrona para as escritas não ficarem bloqueadas.
- Se o primário falhar, promove a réplica, mas só se ela estava síncrona. Caso
  contrário podia perder votos, e é preferível parar a votação.
- Se existirem dois primários, o da linha temporal mais antiga é cercado e parado.
  Ao voltar a arrancar, o pg-entrypoint.sh reconstrói-o como réplica.

Liga-se apenas por rede, para continuar a servir com nós em máquinas diferentes.
Mantém o estado em memória: se reiniciar, não promove até voltar a ver a réplica
síncrona.
"""

import logging
import os
import time

import psycopg2

NOS = os.environ.get("MONITOR_NOS", "db-primary,db-replica").split(",")
PASSWORD = os.environ["POSTGRES_PASSWORD"]
INTERVALO = float(os.environ.get("MONITOR_INTERVALO", "1"))
FALHAS_ATE_PROMOVER = int(os.environ.get("MONITOR_FALHAS_PRIMARIO", "3"))
FALHAS_ATE_ASSINCRONO = int(os.environ.get("MONITOR_FALHAS_REPLICA", "2"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(message)s")
log = logging.getLogger("monitor")


def ligar(no):
    ligacao = psycopg2.connect(
        host=no,
        dbname="postgres",
        user="postgres",
        password=PASSWORD,
        connect_timeout=2,
        application_name="trustvote-monitor",
    )
    ligacao.autocommit = True
    return ligacao


def consultar(ligacao, sql):
    with ligacao.cursor() as cursor:
        cursor.execute(sql)
        return cursor.fetchall() if cursor.description else None


def ler_estado(no):
    """Devolve (em_recuperacao, linha_temporal), ou None se o nó não responder."""
    try:
        ligacao = ligar(no)
    except psycopg2.OperationalError:
        return None
    try:
        return consultar(
            ligacao,
            "SELECT pg_is_in_recovery(), (SELECT timeline_id FROM pg_control_checkpoint())",
        )[0]
    except psycopg2.Error:
        return None
    finally:
        ligacao.close()


def definir_sincrono(ligacao, valor):
    consultar(ligacao, f"ALTER SYSTEM SET synchronous_standby_names = '{valor}'")
    consultar(ligacao, "SELECT pg_reload_conf()")


class Monitor:
    def __init__(self):
        self.falhas_primario = 0
        self.falhas_replica = 0
        self.replica_sincrona = False

    def gerir_primario(self, no):
        """Ajusta a replicação ao estado da réplica."""
        self.falhas_primario = 0
        ligacao = ligar(no)
        try:
            atual = consultar(ligacao, "SHOW synchronous_standby_names")[0][0]
            replicas = consultar(
                ligacao,
                "SELECT sync_state FROM pg_stat_replication WHERE state = 'streaming'",
            )
            if replicas:
                self.falhas_replica = 0
                self.replica_sincrona = replicas[0][0] == "sync"
                if not atual:
                    definir_sincrono(ligacao, "*")
                    log.info("réplica ativa: replicação síncrona ligada em %s", no)
                return

            self.replica_sincrona = False
            self.falhas_replica += 1
            if atual and self.falhas_replica >= FALHAS_ATE_ASSINCRONO:
                definir_sincrono(ligacao, "")
                log.warning("sem réplica: votos sem cópia síncrona em %s", no)
        finally:
            ligacao.close()

    def promover(self, no):
        ligacao = ligar(no)
        try:
            consultar(ligacao, "SELECT pg_promote(true, 15)")
            # A nova primária ainda não tem réplica: não pode esperar por ela.
            definir_sincrono(ligacao, "")
        finally:
            ligacao.close()
        self.falhas_primario = 0
        self.replica_sincrona = False
        log.warning("FAILOVER: %s promovido a primário", no)

    def tratar_sem_primario(self, estados):
        self.falhas_primario += 1
        vivos = [no for no, estado in estados.items() if estado]
        log.warning("sem primário há %d verificações", self.falhas_primario)
        if self.falhas_primario < FALHAS_ATE_PROMOVER or not vivos:
            return
        if not self.replica_sincrona:
            log.error("%s não estava síncrona: promoção recusada", vivos[0])
            return
        self.promover(vivos[0])

    def cercar(self, estados):
        """Dois primários: fica o da linha temporal mais recente."""
        ordenados = sorted(estados, key=lambda no: estados[no][1])
        antigo, recente = ordenados
        if estados[antigo][1] == estados[recente][1]:
            log.error("dois primários na mesma linha temporal: intervenção manual")
            return
        log.warning("dois primários: a cercar %s", antigo)
        ligacao = ligar(antigo)
        try:
            consultar(ligacao, "ALTER SYSTEM SET default_transaction_read_only = on")
            consultar(ligacao, "SELECT pg_reload_conf()")
            consultar(
                ligacao,
                "SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                "WHERE backend_type = 'client backend' AND pid <> pg_backend_pid()",
            )
            consultar(ligacao, "COPY (SELECT 1) TO PROGRAM 'pg_ctl stop -m fast -D \"$PGDATA\" &'")
        finally:
            ligacao.close()

    def ciclo(self):
        estados = {no: ler_estado(no) for no in NOS}
        primarios = [no for no, estado in estados.items() if estado and not estado[0]]
        if len(primarios) == 2:
            self.cercar(estados)
        elif primarios:
            self.gerir_primario(primarios[0])
        else:
            self.tratar_sem_primario(estados)


def main():
    log.info("a vigiar %s", ", ".join(NOS))
    monitor = Monitor()
    while True:
        try:
            monitor.ciclo()
        except psycopg2.Error as erro:
            log.warning("verificação falhou: %s", str(erro).strip())
        time.sleep(INTERVALO)


if __name__ == "__main__":
    main()
