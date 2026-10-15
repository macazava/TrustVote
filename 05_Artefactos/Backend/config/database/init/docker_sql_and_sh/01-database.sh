#!/bin/bash
set -e
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB"
     -v auth_pw='$TrustVote_PASSWORD'
     -v replicator_pw='$PASSWORD_REPLICADOR'
CREATE ROLE trustvote                   LOGIN ENCRYPTED PASSWORD :'trustvote_pw';
CREATE ROLE trustvote_replicada       LOGIN ENCRYPTED PASSWORD :'replicador_pw';

CREATE DATABASE trustvote OWNER trustvote;
GRANT ALL PRIVILEGES ON DATABASE trustvote TO trustvote;

CREATE DATABASE trustvote_replicada OWNER trustvote_replicada;
GRANT ALL PRIVILEGES ON DATABASE trustvote_replicada TO trustvote_replicada;


REVOKE CONNECT ON DATABASE trustvote FROM PUBLIC;
REVOKE CONNECT ON DATABASE trustvote_replicada FROM PUBLIC;
EOSQL
