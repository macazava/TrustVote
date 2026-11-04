#!/bin/sh
# TrustVote — arranque de um nó Redis ou de um Sentinel (o mesmo script para os dois).
#
#   sh arranque.sh redis      -> redis-server, principal ou réplica
#   sh arranque.sh sentinel   -> redis-sentinel a vigiar o grupo "trustvote"
#
# Os dois perguntam primeiro aos Sentinels que já estão a correr quem é o Redis
# principal. Assim, um servidor que volta depois de cair entra como réplica do nó
# que foi promovido, em vez de se declarar principal outra vez.
#
# Variáveis: REDISCLI_AUTH (password), REDIS_NOME (nome, só para os logs), REDIS_IP
# (IP fixo deste nó), REDIS_SENTINELS (IP:porta,...), REDIS_PRINCIPAL_INICIAL (IP do
# principal quando nenhum Sentinel responde, ou seja, no primeiro arranque).
# Tudo por IP e não por nome: ver o comentário dos IPs em comum.yaml.
set -eu

GRUPO=trustvote
PASSWORD="$REDISCLI_AUTH"

# Pergunta a cada Sentinel (exceto a este) qual é o principal; escreve o nome ou nada
principal_atual() {
    for s in $(echo "$REDIS_SENTINELS" | tr ',' ' '); do
        anfitriao=${s%:*}
        porta=${s#*:}
        [ "$anfitriao" = "$REDIS_IP" ] && continue
        resposta=$(timeout 2 redis-cli --no-auth-warning -h "$anfitriao" -p "$porta" \
            sentinel get-master-addr-by-name "$GRUPO" 2>/dev/null | head -n 1) || true
        if [ -n "$resposta" ]; then
            echo "$resposta"
            return
        fi
    done
}

PRINCIPAL=$(principal_atual)
if [ -z "$PRINCIPAL" ]; then
    PRINCIPAL="$REDIS_PRINCIPAL_INICIAL"
    echo "Nenhum Sentinel respondeu: principal inicial = $PRINCIPAL"
else
    echo "Os Sentinels dizem que o principal é $PRINCIPAL"
fi

case "$1" in
redis)
    if [ "$PRINCIPAL" = "$REDIS_IP" ]; then
        REPLICA=""
        echo "$REDIS_NOME arranca como principal"
    else
        REPLICA="--replicaof $PRINCIPAL 6379"
        echo "$REDIS_NOME arranca como réplica de $PRINCIPAL"
    fi
    # shellcheck disable=SC2086
    exec redis-server /usr/local/etc/redis/redis.conf \
        --requirepass "$PASSWORD" --masterauth "$PASSWORD" \
        --replica-announce-ip "$REDIS_IP" $REPLICA
    ;;
sentinel)
    # O Sentinel reescreve o ficheiro de configuração, por isso é gerado a cada arranque
    cat >/tmp/sentinel.conf <<EOF
port 26379
dir /tmp
sentinel announce-ip $REDIS_IP
requirepass $PASSWORD
sentinel sentinel-pass $PASSWORD
# Quórum 2 de 3: um servidor em baixo não impede a promoção da réplica
sentinel monitor $GRUPO $PRINCIPAL 6379 2
sentinel auth-pass $GRUPO $PASSWORD
sentinel down-after-milliseconds $GRUPO 3000
sentinel failover-timeout $GRUPO 10000
sentinel parallel-syncs $GRUPO 1
EOF
    exec redis-sentinel /tmp/sentinel.conf
    ;;
*)
    echo "Uso: arranque.sh redis|sentinel" >&2
    exit 1
    ;;
esac
