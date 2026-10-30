#!/bin/sh
# Entrypoint comum aos dois nós PostgreSQL.
#
#   PG_NODE_ROLE=primary -> comportamento normal da imagem oficial
#                           (initdb + scripts de /docker-entrypoint-initdb.d se o volume estiver vazio)
#   PG_NODE_ROLE=replica -> se o volume estiver vazio, clona o nó PG_UPSTREAM_HOST com
#                           pg_basebackup (-R cria standby.signal + primary_conninfo) e
#                           arranca como réplica só de leitura (hot standby).
#
# Um volume que já tem dados nunca é reinicializado nem reclonado: para mudar o papel
# de um nó que já tem dados é preciso apagar o volume dele (ver README).
set -eu

: "${PGDATA:=/var/lib/postgresql/data}"
: "${PG_NODE_ROLE:=primary}"

if [ "$PG_NODE_ROLE" = "replica" ] && [ ! -s "$PGDATA/PG_VERSION" ]; then
    : "${PG_UPSTREAM_HOST:?PG_UPSTREAM_HOST obrigatório para uma réplica}"
    : "${PG_SLOT_NAME:?PG_SLOT_NAME obrigatório para uma réplica}"
    export PGPASSWORD="$REPLICATION_PASSWORD"

    echo "[pg-entrypoint] réplica sem dados: a aguardar por $PG_UPSTREAM_HOST..."
    until pg_isready -q -h "$PG_UPSTREAM_HOST" -p 5432 -U "$REPLICATION_USER" -d postgres; do
        sleep 2
    done

    # Slot de replicação no nó de origem: impede que apague WAL que a réplica ainda não recebeu
    # (limitado por max_slot_wal_keep_size para não encher o disco se a réplica ficar parada).
    psql -v ON_ERROR_STOP=1 -h "$PG_UPSTREAM_HOST" -U "$REPLICATION_USER" -d postgres -qAt -c \
        "SELECT pg_create_physical_replication_slot('$PG_SLOT_NAME')
         WHERE NOT EXISTS (SELECT 1 FROM pg_replication_slots WHERE slot_name = '$PG_SLOT_NAME');" >/dev/null

    mkdir -p "$PGDATA"
    chown postgres:postgres "$PGDATA"
    chmod 700 "$PGDATA"

    echo "[pg-entrypoint] a clonar $PG_UPSTREAM_HOST com pg_basebackup..."
    gosu postgres pg_basebackup \
        -h "$PG_UPSTREAM_HOST" -p 5432 -U "$REPLICATION_USER" \
        -D "$PGDATA" -X stream -R -S "$PG_SLOT_NAME" --checkpoint=fast
    echo "[pg-entrypoint] clone concluído; a arrancar como réplica."
fi

# Proteção contra dois primários (split-brain): um nó configurado como réplica que tem
# dados mas não está em modo standby (ex.: o antigo primário depois de um failover)
# NÃO arranca, para não aceitar escritas independentes. Ver README > Recuperação.
if [ "$PG_NODE_ROLE" = "replica" ] && [ -s "$PGDATA/PG_VERSION" ] && [ ! -f "$PGDATA/standby.signal" ]; then
    echo "[pg-entrypoint] RECUSADO: PG_NODE_ROLE=replica mas o volume contém um primário." >&2
    echo "[pg-entrypoint] Apague o volume deste nó para o reclonar de $PG_UPSTREAM_HOST," >&2
    echo "[pg-entrypoint] ou defina PG_NODE_ROLE=primary se este for o primário em uso." >&2
    exit 1
fi

# Segunda proteção: um nó configurado como primário, com dados, não arranca se o outro nó já
# estiver a aceitar escritas (ex.: a réplica foi promovida e este é o antigo primário a voltar,
# mesmo por reinício automático). Sem isto, haveria dois primários e o backend, que liga aos
# dois hosts, podia voltar a escrever no antigo.
if [ "$PG_NODE_ROLE" = "primary" ] && [ -s "$PGDATA/PG_VERSION" ] && [ ! -f "$PGDATA/standby.signal" ] \
   && [ -n "${PG_UPSTREAM_HOST:-}" ]; then
    export PGPASSWORD="$REPLICATION_PASSWORD" PGCONNECT_TIMEOUT=3
    em_recuperacao=$(psql -h "$PG_UPSTREAM_HOST" -U "$REPLICATION_USER" -d postgres -qAt \
                     -c "SELECT pg_is_in_recovery()" 2>/dev/null || true)
    unset PGPASSWORD
    if [ "$em_recuperacao" = "f" ]; then
        echo "[pg-entrypoint] RECUSADO: $PG_UPSTREAM_HOST já é primário (a réplica foi promovida)." >&2
        echo "[pg-entrypoint] Reconstrua este nó como réplica (README > Restabelecer a replicação)." >&2
        exit 1
    fi
fi

exec docker-entrypoint.sh "$@"
