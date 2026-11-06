#!/bin/sh
# TrustVote — cópias automáticas da base de dados (contentor "backup", no árbitro).
#
#   sh backup.sh servico   faz uma cópia a cada BACKUP_INTERVALO_HORAS (o arranque do contentor)
#   sh backup.sh agora     faz uma cópia já (.\stack.cmd backup)
#   sh backup.sh saude     healthcheck: a última cópia boa é recente?
#
# Cada cópia (pg_dump, comprimida) é CONFIRMADA antes de contar como boa: é restaurada num
# PostgreSQL temporário criado dentro deste contentor, sem tocar nos dados reais. Ficam as
# últimas BACKUP_MANTER; as mais antigas são apagadas. A replicação copia também os erros
# (um DELETE errado vai para os dois nós), por isso não substitui estas cópias.
set -eu

PASTA=/backups
ESTADO=$PASTA/.ultimo-ok
INTERVALO=$(( ${BACKUP_INTERVALO_HORAS:-6} * 3600 ))
MANTER=${BACKUP_MANTER:-28}
NOS=${BACKUP_NOS:-db-replica db-primary}
TMP=/tmp/trustvote-backup
export PGCONNECT_TIMEOUT=5

registar() { echo "[backup $(date '+%Y-%m-%d %H:%M:%S')] $*"; }

# Restaura a cópia num PostgreSQL temporário e confirma que tem as tabelas e os dados
verificar() {
    copia=$1
    rm -rf "$TMP/verificar" && mkdir -p "$TMP/verificar" && chown postgres "$TMP/verificar"
    gosu postgres initdb -D "$TMP/verificar/dados" -U postgres -A trust >/dev/null
    gosu postgres pg_ctl -D "$TMP/verificar/dados" -l "$TMP/verificar/log" -w \
        -o "-c listen_addresses='' -k $TMP/verificar -p 5499" start >/dev/null
    psql() { command psql -h "$TMP/verificar" -p 5499 -U postgres -v ON_ERROR_STOP=1 "$@"; }
    resultado=0
    if psql -q -d postgres -c "CREATE DATABASE trustvote" >/dev/null &&
        gunzip -c "$copia" | psql -q -d trustvote >/dev/null 2>"$TMP/verificar/erros"; then
        tabelas=$(psql -tA -d trustvote -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")
        contas=$(psql -tA -d trustvote -c "SELECT count(*) FROM utilizador")
        votos=$(psql -tA -d trustvote -c "SELECT count(*) FROM voto")
        if [ "$tabelas" -ge 13 ]; then
            registar "confirmada: restaura com $tabelas tabelas, $contas contas e $votos votos"
        else
            registar "ERRO: a cópia restaurada só tem $tabelas tabelas"; resultado=1
        fi
    else
        registar "ERRO: a cópia não restaura: $(head -c 300 "$TMP/verificar/erros")"; resultado=1
    fi
    gosu postgres pg_ctl -D "$TMP/verificar/dados" -m immediate stop >/dev/null 2>&1 || true
    rm -rf "$TMP/verificar"
    return $resultado
}

fazer_copia() {
    mkdir -p "$PASTA" "$TMP"
    nome="trustvote-$(date +%Y%m%d-%H%M%S).sql.gz"
    origem=""
    for no in $NOS; do
        if pg_dump -h "$no" -U postgres --no-owner --no-privileges -f "$TMP/copia.sql" trustvote 2>"$TMP/erro"; then
            origem=$no; break
        fi
        registar "$no não respondeu ($(head -c 120 "$TMP/erro")); a tentar o seguinte"
    done
    if [ -z "$origem" ]; then registar "ERRO: nenhum nó da BD respondeu"; return 1; fi

    gzip -c "$TMP/copia.sql" > "$TMP/copia.sql.gz" && rm -f "$TMP/copia.sql"
    verificar "$TMP/copia.sql.gz" || { rm -f "$TMP/copia.sql.gz"; return 1; }
    mv "$TMP/copia.sql.gz" "$PASTA/$nome"
    date +%s > "$ESTADO"
    registar "cópia $nome ($(( $(wc -c < "$PASTA/$nome") / 1024 )) KB) feita a partir de $origem"

    # Só as últimas MANTER
    ls -1t "$PASTA"/trustvote-*.sql.gz 2>/dev/null | tail -n +$(( MANTER + 1 )) | while read -r antiga; do
        rm -f "$antiga"; registar "apagada a cópia antiga $(basename "$antiga")"
    done
}

idade_ultima() {  # segundos desde a última cópia boa (muito grande se não houver)
    if [ -f "$ESTADO" ]; then echo $(( $(date +%s) - $(cat "$ESTADO") )); else echo 999999999; fi
}

case "${1:-servico}" in
servico)
    registar "a correr: uma cópia a cada ${BACKUP_INTERVALO_HORAS:-6} h, ficam as últimas $MANTER"
    while true; do
        espera=$(( INTERVALO - $(idade_ultima) ))
        if [ "$espera" -le 0 ]; then
            # Se falhar (ex.: BD a meio de um failover), tenta outra vez dentro de 5 minutos
            fazer_copia || { registar "nova tentativa dentro de 5 minutos"; sleep 300; continue; }
            espera=$INTERVALO
        fi
        sleep "$espera"
    done
    ;;
agora)
    fazer_copia
    ;;
saude)
    [ "$(idade_ultima)" -lt $(( INTERVALO * 2 )) ]
    ;;
*)
    echo "Uso: backup.sh servico|agora|saude" >&2
    exit 2
    ;;
esac
