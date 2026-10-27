# 5. Replicação e Cópias de Segurança

## 5.1 Replicação

| | `db-primary` | `db-replica` |
|---|---|---|
| Papel | aceita leituras e escritas | **só leitura** (hot standby) |
| Volume | `pg-primary-data` | `pg-replica-data` |
| Porta (debug) | `127.0.0.1:15432` | `127.0.0.1:15433` |

- Replicação **física em streaming, assíncrona**: cada alteração no primário é enviada à réplica quase
  de imediato.
- No primeiro arranque, a réplica clona o primário com `pg_basebackup` e passa a receber o WAL.
- Um **slot de replicação** impede o primário de apagar alterações que a réplica ainda não recebeu
  (limite de 1 GB para não encher o disco).
- **Assíncrona ⇒ pode haver perda**: o que foi confirmado no primário mas ainda não chegou à réplica
  no momento de uma falha perde-se.
- A replicação **não substitui cópias de segurança**: um `DELETE` errado também é replicado.

Verificar:

```powershell
docker compose exec db-primary psql -U postgres -c "select state, sync_state, replay_lag from pg_stat_replication"
docker compose exec db-replica psql -U postgres -c "select pg_is_in_recovery()"   # t = réplica
```

## 5.2 Promover a réplica (o primário falhou)

Não há failover automático: é feito à mão, pela ordem abaixo (testado).

```powershell
cd 05_Artefactos\Infraestrutura
docker compose stop db-primary                                              # 1. garantir que o primário parou
docker compose exec db-replica psql -U postgres -c "select pg_promote()"   # 2. promover
# 3. no .env: DB_REPLICA_NODE_ROLE=primary, DB_PRIMARY_NODE_ROLE=replica,
#             DB_WRITE_HOST=db-replica, DB_READ_HOST=db-replica
docker compose up -d --no-deps db-replica servidor1 servidor2 worker      # 4. aplicar
```

O antigo primário fica **impedido de arrancar** como primário (proteção contra dois primários).
Para voltar a ter réplica, reconstrói-se a partir do novo primário:

```powershell
docker compose down db-primary
docker volume remove trustvote_pg-primary-data
docker compose up -d --no-deps --wait db-primary
```

Pormenores em `05_Artefactos/Infraestrutura/README.md`, secção 7.

## 5.3 Cópias de segurança (backups)

Os comandos gravam o ficheiro dentro do contentor e copiam-no com `docker cp`. Isto evita os
redirecionamentos `>` e `<` do PowerShell, que estragam ficheiros binários (testado em 27/10/2026:
cópia restaurada com os mesmos utilizadores, votos e registos de auditoria que a original).

**Fazer a cópia** (esquema + dados), no primário:

```powershell
cd 05_Artefactos\Infraestrutura
$f = "trustvote_$(Get-Date -Format yyyyMMdd_HHmm).dump"
docker compose exec -T db-primary pg_dump -U postgres -d trustvote -Fc -f /tmp/$f
mkdir backups -Force
docker cp "trustvote-db-primary:/tmp/$f" "backups\$f"
```

**Restaurar** (substitui os dados atuais pelos da cópia):

```powershell
docker cp "backups\<ficheiro>.dump" trustvote-db-primary:/tmp/restaurar.dump
docker compose exec -T db-primary pg_restore -U postgres -d trustvote --clean --if-exists --no-owner --role=trustvote /tmp/restaurar.dump
```

Para experimentar sem tocar nos dados, restaurar antes para uma BD à parte
(`CREATE DATABASE tv_restauro_teste OWNER trustvote` e `-d tv_restauro_teste`).

- A pasta `backups/` e os ficheiros `*.dump` estão no `.gitignore` (contêm dados pessoais).
- Guardar as cópias **fora deste PC**: tudo corre na mesma máquina, por isso uma avaria do disco
  perde a BD, a réplica e as cópias locais ao mesmo tempo.
- Para os votos e os TOTP continuarem verificáveis depois de restaurar, é preciso guardar também a
  pasta `Infraestrutura/secrets/` (sem ela os hashes dos votos não se conseguem confirmar).
