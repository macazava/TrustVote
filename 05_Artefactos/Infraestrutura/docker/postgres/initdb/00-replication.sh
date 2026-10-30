#!/bin/sh
# Corre apenas na primeira inicialização de um nó primário (volume vazio).
# Cria o utilizador de replicação e autoriza ligações de replicação vindas da
# rede Docker interna (o PostgreSQL não está publicado no anfitrião).
# Nota: o entrypoint oficial pode fazer "source" deste ficheiro, por isso não usar "set -u".
set -e

psql -v ON_ERROR_STOP=1 -v repl_user="$REPLICATION_USER" -v repl_password="$REPLICATION_PASSWORD" \
     --username "$POSTGRES_USER" --dbname postgres <<'EOSQL'
SELECT format('CREATE ROLE %I WITH REPLICATION LOGIN PASSWORD %L', :'repl_user', :'repl_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'repl_user')
\gexec
EOSQL

# "samenet" = qualquer endereço da sub-rede da trustvote-network.
echo "host replication $REPLICATION_USER samenet scram-sha-256" >> "$PGDATA/pg_hba.conf"
