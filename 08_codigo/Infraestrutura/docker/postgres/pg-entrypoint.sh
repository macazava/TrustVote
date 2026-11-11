#!/bin/sh
# Entrypoint comum aos dois nós PostgreSQL. O papel de cada nó depende dos dados e do
# outro nó, porque o monitor de failover pode trocá-los com o sistema a correr:
#
#   volume vazio            -> clona o outro nó se ele for primário (ou se PG_NODE_ROLE=replica,
#                              caso em que espera por ele); senão, cria a base de dados
#   volume de réplica       -> arranca como réplica
#   volume de primário      -> arranca como primário, exceto se o outro nó já for primário
#                              numa linha temporal mais recente: nesse caso, este nó é o
#                              antigo primário e os dados são reconstruídos a partir do outro
set -eu

: "${PGDATA:=/var/lib/postgresql/data}"
: "${PG_NODE_ROLE:=primary}"
: "${PG_UPSTREAM_HOST:?PG_UPSTREAM_HOST obrigatório}"
: "${PG_SLOT_NAME:?PG_SLOT_NAME obrigatório}"

export PGPASSWORD="$REPLICATION_PASSWORD"
export PGCONNECT_TIMEOUT=2

consultar_outro_no() {
    psql -h "$PG_UPSTREAM_HOST" -U "$REPLICATION_USER" -d postgres -qAt -c "$1" 2>/dev/null || true
}

outro_no_e_primario() {
    [ "$(consultar_outro_no 'SELECT pg_is_in_recovery()')" = "f" ]
}

clonar_outro_no() {
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
}

if [ ! -s "$PGDATA/PG_VERSION" ]; then
    if [ "$PG_NODE_ROLE" = "replica" ]; then
        echo "[pg-entrypoint] sem dados: a aguardar por $PG_UPSTREAM_HOST..."
        until pg_isready -q -h "$PG_UPSTREAM_HOST" -p 5432 -U "$REPLICATION_USER" -d postgres; do
            sleep 2
        done
        clonar_outro_no
    elif outro_no_e_primario; then
        clonar_outro_no
    fi
elif [ ! -f "$PGDATA/standby.signal" ] && outro_no_e_primario; then
    # Proteção contra dois primários (split-brain).
    local_tl=$(gosu postgres pg_controldata -D "$PGDATA" | sed -n "s/^Latest checkpoint's TimeLineID: *//p")
    outro_tl=$(consultar_outro_no "SELECT timeline_id FROM pg_control_checkpoint()")
    if [ "${outro_tl:-0}" -le "${local_tl:-0}" ]; then
        echo "[pg-entrypoint] RECUSADO: $PG_UPSTREAM_HOST é primário, sem linha temporal mais recente." >&2
        exit 1
    fi
    echo "[pg-entrypoint] este nó é um antigo primário: a reconstruir a partir de $PG_UPSTREAM_HOST."
    find "$PGDATA" -mindepth 1 -delete
    clonar_outro_no
fi

unset PGPASSWORD PGCONNECT_TIMEOUT
exec docker-entrypoint.sh "$@"
