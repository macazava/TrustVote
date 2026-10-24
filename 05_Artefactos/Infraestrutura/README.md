# TrustVote — Infraestrutura Docker (ambiente local)

Infraestrutura para executar o TrustVote **num único PC Windows** com Docker Desktop:
balanceador de carga, duas instâncias da aplicação, PostgreSQL com réplica e Redis.

> **Estado atual:** as duas instâncias (`servidor1`, `servidor2`) correm o **backend FastAPI**
> (`05_Artefactos/Backend`), com autenticação e gestão eleitoral. Votação, resultados e o
> frontend ainda não estão integrados.

---

## 1. Arquitetura

```
                  Windows (anfitrião) — um único PC físico
 ┌──────────────────────────────────────────────────────────────────────────┐
 │ browser / cliente                                                        │
 │      │  http://127.0.0.1:8080   (única porta publicada por defeito)      │
 │ ┌────▼──────────────────── rede Docker: trustvote-network ─────────────┐ │
 │ │  ┌────────┐   round-robin  ┌───────────┐                             │ │
 │ │  │ nginx  ├───────────────►│ servidor1 ├──┐                          │ │
 │ │  │  (LB)  ├───────────────►│ servidor2 ├──┤                          │ │
 │ │  └────────┘                └───────────┘  │                          │ │
 │ │                    escritas/leituras      │      cache/filas         │ │
 │ │              ┌────────────────────────────┤──────────────┐           │ │
 │ │        ┌─────▼──────┐  streaming WAL ┌────▼───────┐ ┌────▼────┐      │ │
 │ │        │ db-primary ├───────────────►│ db-replica │ │  redis  │      │ │
 │ │        │ (leitura + │   (assíncrono) │ (só leitura│ └────┬────┘      │ │
 │ │        │  escrita)  │                │ hot standby│      │           │ │
 │ │        └─────┬──────┘                └─────┬──────┘      │           │ │
 │ └──────────────┼─────────────────────────────┼─────────────┼───────────┘ │
 │        pg-primary-data               pg-replica-data   redis-data        │
 │                  (volumes Docker persistentes)                           │
 └──────────────────────────────────────────────────────────────────────────┘
```

| Contentor | Serviço | Imagem | Função |
|---|---|---|---|
| `trustvote-nginx` | `nginx` | `nginx:1.28-alpine` | Reverse proxy e balanceador de carga (round-robin); único ponto de entrada |
| `trustvote-servidor1` | `servidor1` | `trustvote-backend:dev` (build de `../Backend`) | Instância 1 da API |
| `trustvote-servidor2` | `servidor2` | `trustvote-backend:dev` (mesma imagem) | Instância 2, independente da 1 |
| `trustvote-db-primary` | `db-primary` | `postgres:16` | PostgreSQL primário (aceita escritas) |
| `trustvote-db-replica` | `db-replica` | `postgres:16` | Réplica *hot standby* (só leitura), candidata a promoção |
| `trustvote-redis` | `redis` | `redis:7.4-alpine` | Cache / filas / coordenação. **Não** é fonte de verdade dos dados |

### Três níveis distintos de redundância

| Nível | O que existe aqui | Protege contra | **Não** protege contra |
|---|---|---|---|
| Redundância de contentores | 2 instâncias da aplicação atrás do nginx | Falha/paragem de uma instância | Falha do nginx (instância única) |
| Replicação de dados | Réplica PostgreSQL em streaming assíncrono | Perda do contentor/volume do primário | Erros lógicos (um `DELETE` errado é replicado); transações ainda não replicadas no momento da falha |
| Tolerância a falhas do servidor físico | **Nenhuma** | — | Avaria do PC, disco, Docker Desktop ou Windows: **tudo para** |

Isto **não é um cluster de máquinas independentes**: todos os contentores partilham o mesmo
PC, o mesmo disco e o mesmo motor Docker.

---

## 2. Estrutura dos ficheiros

```
05_Artefactos/Infraestrutura/
├── compose.yaml                  # definição de todos os serviços
├── compose.debug.yaml            # OPCIONAL: publica a BD em 127.0.0.1:15432/15433
├── .env.example                  # variáveis necessárias (valores ilustrativos)
├── .gitignore                    # exclui .env e ficheiros locais
├── .gitattributes                # força LF nos scripts (correm em Linux)
├── README.md
└── docker/
    ├── nginx/default.conf                  # upstream, deteção de falhas, logs
    ├── postgres/pg-entrypoint.sh           # entrypoint comum: primário ou réplica (pg_basebackup)
    ├── postgres/initdb/00-replication.sh   # cria utilizador de replicação + pg_hba
    └── redis/redis.conf                    # persistência AOF, limites, comandos perigosos desativados
```

O **esquema da base de dados** não é duplicado aqui: é montado diretamente de
`05_Artefactos/Backend/config/database/init/docker_sql_and_sh/`
(`00-trustvote-user.sql` → cria o utilizador `trustvote` e torna-o dono da BD;
`trustvote.sql` → tabelas, executadas como `trustvote` via `SET ROLE`).

> O `docker-compose.yml` antigo nessa pasta do Backend é substituído por este `compose.yaml`.
> Não usar os dois em simultâneo (têm o mesmo nome de projeto, `trustvote`).

---

## 3. Requisitos

- Windows 10/11 com **WSL 2** (`wsl --install` numa consola de administrador + reiniciar)
- **Docker Desktop** (testado com Docker Engine 29.8 / Compose v5.5)
- Portas livres no anfitrião: `8080` (nginx). Opcional: `15432`, `15433` (modo debug)

## 4. Configurar o `.env`

```powershell
cd 05_Artefactos\Infraestrutura
copy .env.example .env
# editar .env e substituir TODOS os "mudar_*" por passwords fortes
```

| Variável | Uso |
|---|---|
| `POSTGRES_PASSWORD` | superutilizador `postgres` (administração) |
| `TRUSTVOTE_DB_PASSWORD` | utilizador `trustvote`, usado pelo backend |
| `REPLICATION_PASSWORD` | utilizador `replicator` (primário → réplica) |
| `REDIS_PASSWORD` | autenticação do Redis |
| `NGINX_BIND_ADDRESS` / `NGINX_HTTP_PORT` | onde o nginx é publicado (por defeito `127.0.0.1:8080`) |
| `DB_WRITE_HOST`, `DB_READ_HOST`, `DB_*_NODE_ROLE`, `DB_*_UPSTREAM` | só para o failover manual (secção 7) |

O `docker compose` recusa arrancar se faltar alguma password.

### Segredos do backend (1.ª vez)

As duas instâncias partilham as chaves JWT (RS256) e a chave que cifra os segredos TOTP.
Ficam em `secrets/` (ignorada pelo git) e são montadas como Docker secrets:

```powershell
cd 05_Artefactos\Backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m app.scripts.gerar_segredos ..\Infraestrutura\secrets
```

Depois do 1.º arranque, criar o administrador:
`docker compose exec servidor1 python -m app.scripts.criar_admin admin@trustvote.pt "Administrador"`

## 5. Comandos

```powershell
docker compose up -d --wait          # iniciar (espera pelos healthchecks)
docker compose ps                    # estado + health
docker compose logs -f nginx         # logs de um serviço (ou sem nome = todos)
docker compose restart servidor1     # reiniciar só uma instância
docker compose stop                  # parar (mantém dados)
docker compose down                  # parar e remover contentores (mantém volumes/dados)
docker compose down -v               # APAGA TAMBÉM OS DADOS (volumes)
```

### Ver a base de dados num cliente (IntelliJ Database, DBeaver, pgAdmin)

A BD é **PostgreSQL** (não MySQL) e **não está publicada por defeito**. Para desenvolvimento:

```powershell
docker compose -f compose.yaml -f compose.debug.yaml up -d --wait
```

| | Host | Porta | BD | Utilizador | Password |
|---|---|---|---|---|---|
| Primário | `127.0.0.1` | `15432` | `trustvote` | `trustvote` | `TRUSTVOTE_DB_PASSWORD` do `.env` |
| Réplica (só leitura) | `127.0.0.1` | `15433` | `trustvote` | `trustvote` | idem |

Usa-se 15432 porque um PostgreSQL instalado diretamente no Windows já pode ocupar a 5432.

### Scripts de inicialização só correm com volume vazio

Os ficheiros `.sql` / `.sh` de `docker-entrypoint-initdb.d` **só são executados quando o
volume do PostgreSQL está vazio**. Depois de alterar o esquema:

```powershell
docker compose exec db-primary psql -U postgres -d trustvote -c "\dt"   # ver o que existe
docker compose down -v ; docker compose up -d --wait                    # recriar (APAGA dados)
```

Com dados que interessam, aplicar a alteração por migração (`ALTER TABLE ...`) em vez de recriar.

---

## 6. Balanceamento e falha de uma instância

Configuração em `docker/nginx/default.conf`:

- **Round-robin** entre `servidor1:8080` e `servidor2:8080`.
- **Deteção passiva:** 2 falhas em 10 s (`max_fails=2 fail_timeout=10s`) retiram a instância
  durante 10 s; depois volta a ser experimentada automaticamente.
- **Reencaminhamento:** em erro de ligação, timeout (2 s) ou 502/503/504, o pedido é repetido
  na outra instância (`proxy_next_upstream`). Pedidos **não idempotentes** (ex.: `POST` de um voto)
  que já chegaram a uma instância **não** são repetidos, para evitar votos duplicados.
- **Resolução DNS dinâmica** (`resolver 127.0.0.11` + `resolve`): uma instância recriada com
  IP novo volta a receber pedidos sem reiniciar o nginx.
- O nginx arranca mesmo com uma instância em baixo (depende só de `service_started`).
- Cada contentor tem *healthcheck* em `GET /health` → `docker compose ps` mostra `unhealthy`.

**Verificar que ambos recebem pedidos:**
```powershell
1..10 | % { (Invoke-WebRequest http://127.0.0.1:8080/ -UseBasicParsing).Headers['X-Upstream-Server'] }
docker compose logs nginx      # cada linha mostra upstream=<ip:porta> e upstream_status
```

**Simular falha / substituir uma instância sem tocar no resto:**
```powershell
docker compose stop servidor1                                  # falha simulada
docker compose start servidor1                                 # recuperação
docker compose up -d --no-deps --force-recreate servidor2      # substituir contentor (nova imagem, etc.)
```

---

## 7. Replicação PostgreSQL

### Como funciona
- Replicação **física em streaming, assíncrona** (`wal_level=replica`).
- No primeiro arranque, `db-replica` encontra o volume vazio e clona o primário com
  `pg_basebackup -R` (cria `standby.signal` + `primary_conninfo`). Depois recebe o WAL continuamente.
- Um **slot de replicação** (`db_replica_slot`) impede o primário de apagar WAL que a réplica
  ainda não recebeu; limitado a 1 GB (`max_slot_wal_keep_size`) para não encher o disco.
- A réplica é **só de leitura** (`hot_standby`): qualquer escrita falha com
  `cannot execute INSERT in a read-only transaction`. Só existe **um** nó a aceitar escritas.
- Volumes separados: `pg-primary-data` e `pg-replica-data`.

**Verificar:**
```powershell
docker compose exec db-primary psql -U postgres -c "select application_name,state,sync_state,replay_lag from pg_stat_replication"
docker compose exec db-replica psql -U postgres -c "select pg_is_in_recovery()"   # t = réplica
```

### Limites (importante)
- **Não há failover automático.** A promoção é manual (abaixo). Um gestor de failover
  (Patroni + etcd, repmgr, pg_auto_failover) exigiria mais componentes e um quórum que, num
  único PC, não traz proteção real; por isso não foi incluído.
- **Assíncrona ⇒ pode haver perda de dados:** transações confirmadas no primário mas ainda não
  enviadas à réplica no momento da falha perdem-se. A replicação **não substitui backups**
  (`pg_dump`), porque erros lógicos também são replicados.
- Após a promoção, as colunas `IDENTITY` podem saltar valores (ex.: de 1 para 34) — comportamento
  normal do PostgreSQL (cache de sequências); não afeta a integridade.

### Proteção contra dois primários (split-brain)
`docker/postgres/pg-entrypoint.sh` recusa arrancar um nó configurado como `replica` cujo volume
contenha um primário (sem `standby.signal`). Assim o antigo primário, depois de um failover,
**não volta sozinho a aceitar escritas** — fica em reinício com a mensagem `RECUSADO` no log.

### Promover a réplica (primário falhou)

```powershell
# 1. Garantir que o primário está mesmo parado (nunca promover com os dois a aceitar escritas)
docker compose stop db-primary

# 2. Promover a réplica
docker compose exec db-replica psql -U postgres -c "select pg_promote()"

# 3. No .env, trocar os papéis e apontar as aplicações para o novo primário:
#      DB_REPLICA_NODE_ROLE=primary
#      DB_PRIMARY_NODE_ROLE=replica
#      DB_WRITE_HOST=db-replica
#      DB_READ_HOST=db-replica

# 4. Aplicar (sem --no-deps o compose tentaria arrancar o db-primary)
docker compose up -d --no-deps db-replica servidor1 servidor2
```

### Restabelecer a replicação (depois de recuperar)

O antigo primário é **reconstruído como réplica** do novo primário (os dados dele podem ter
divergido, por isso são descartados):

```powershell
docker compose down db-primary
docker volume remove trustvote_pg-primary-data
docker compose up -d --no-deps --wait db-primary     # clona db-replica com pg_basebackup
docker compose exec db-replica psql -U postgres -c "select state from pg_stat_replication"   # streaming
```

Fica: `db-replica` = primário, `db-primary` = réplica. Para voltar aos papéis originais, repetir
o mesmo procedimento no sentido inverso numa janela planeada (parar as aplicações, promover
`db-primary`, repor os valores por defeito do `.env`, reconstruir `db-replica`).

---

## 8. Segurança e portas

| Serviço | Porta interna | Publicada no anfitrião |
|---|---|---|
| nginx | 80 | `127.0.0.1:8080` (configurável no `.env`) |
| servidor1 / servidor2 | 8080 | não |
| db-primary / db-replica | 5432 | não (só com `compose.debug.yaml`: `127.0.0.1:15432/15433`) |
| redis | 6379 | não |

- PostgreSQL e Redis só são acessíveis dentro da `trustvote-network`.
- Credenciais apenas no `.env` (ignorado pelo git); o `compose.yaml` só tem referências `${...}`.
- Replicação só aceite da sub-rede Docker (`pg_hba`: `host replication replicator samenet scram-sha-256`).
- Redis com password, `protected-mode`, e `FLUSHALL`/`FLUSHDB`/`DEBUG` desativados.
- Sem IPs fixos: os serviços comunicam por nome (DNS do Docker).

---

## 9. Integração com o backend e o frontend

### Backend (servidor1 / servidor2) — integrado
O backend é construído a partir de `../Backend` (`build:` na âncora `x-app`) e cumpre o contrato:
1. Escutar na porta **8080**.
2. Expor **`GET /health`** → `200` quando a instância está pronta (usado pelo healthcheck).
3. Ler a configuração destas variáveis (já definidas no `compose.yaml`):
   `DATABASE_HOST`, `DATABASE_READ_HOST`, `DATABASE_PORT`, `DATABASE_NAME`, `DATABASE_USER`,
   `DATABASE_PASSWORD`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `APP_INSTANCE`.
4. Ser **stateless**: sessões/tokens não podem ficar em memória de uma instância (usar JWT ou Redis),
   porque o nginx alterna entre instâncias.
5. Escritas sempre em `DATABASE_HOST`. `DATABASE_READ_HOST` (réplica) só para leituras que
   tolerem um pequeno atraso.

Depois de alterar o código: `docker compose up -d --build servidor1 servidor2`.

### Frontend
- Se for estático: servido pelo nginx (montar o `build/` em `/usr/share/nginx/html` e
  encaminhar `/api/` para o upstream), ou num contentor próprio atrás do nginx.
- O browser deve chamar sempre o nginx (`http://127.0.0.1:8080`), nunca as instâncias diretamente.

---

## 10. Resultados dos testes (18/10/2026, Docker Engine 29.8.2)

Executados neste PC. "Placeholder" = testado com o servidor de substituição, **não** com o backend.

| # | Teste | Resultado |
|---|---|---|
| 1 | `docker compose config` | ✅ válido |
| 2 | Download das imagens | ✅ postgres:16, nginx:1.28-alpine, redis:7.4-alpine |
| 3 | Arranque dos serviços | ✅ 6 contentores |
| 4 | Healthchecks | ✅ todos `healthy` |
| 5 | Comunicação interna | ✅ servidor1 → db-primary:5432, db-replica:5432, redis:6379; login `trustvote` pela rede; 10 tabelas criadas, BD pertence a `trustvote`; Redis recusa ligações sem password |
| 6 | Persistência após `down` + `up` | ✅ registo na BD (primário e réplica) e chave Redis mantidos |
| 7 | Balanceamento | ✅ placeholder — 10 pedidos: 5 servidor1 / 5 servidor2 |
| 8 | Falha de uma instância | ✅ placeholder — servidor1 parado: 10/10 respondidos pelo servidor2 (primeiros pedidos ~2 s mais lentos até ao timeout de ligação); servidor1 reiniciado e servidor2 recriado voltam ao round-robin sem reiniciar o nginx |
| 9 | Replicação | ✅ estado `streaming/async`; escrita no primário visível na réplica; escrita na réplica recusada |
| 9b | Promoção + reconstrução | ✅ réplica promovida aceita escritas; antigo primário **recusado** pela proteção; reconstruído como réplica do novo primário, replicação `streaming` e novas escritas replicadas |
| 10 | Portas expostas | ✅ só `127.0.0.1:8080` publicado (BD só com `compose.debug.yaml`, em 127.0.0.1) |

### Com o backend real (24/10/2026)

| Teste | Resultado |
|---|---|
| Healthcheck das 2 instâncias (inclui ligação à BD) | ✅ `healthy`; `/health` alterna servidor1/servidor2 |
| Token emitido por uma instância usado na outra | ✅ 6/6 pedidos `200`, repartidos pelas duas instâncias |
| Fluxo pelo nginx: registo, login, criar eleição, candidatos, ronda, habilitar, agendar, iniciar | ✅; eleitor recebe `403` ao criar eleição; candidato após agendar → `409` |
| Auditoria e réplica | ✅ ações registadas em `auditoria`; dados visíveis na réplica |
| servidor1 parado | ✅ 10/10 pedidos autenticados respondidos (2 reencaminhados após a tentativa falhada) |
| servidor1 de volta | ✅ 5/5 sem reiniciar o nginx |

### Pendentes
- Failover com `POST` de votos (módulo de votação ainda não existe).
- Comportamento das aplicações durante a promoção da BD (reconexão ao novo `DATABASE_HOST`).
- Uso real do Redis (filas/cache) e leituras na réplica.
- Integração do frontend.
