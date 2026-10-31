# TrustVote — Infraestrutura Docker (ambiente local)

Infraestrutura para executar o TrustVote — **votações da Associação de Estudantes de
uma universidade europeia** — **num único PC Windows** com Docker Desktop:
balanceador de carga, duas instâncias da aplicação, PostgreSQL com réplica e Redis.

> Para a visão geral do projeto e como pôr tudo a funcionar, começa pelo
> [README da raiz](../README.md). Este documento detalha apenas a infraestrutura.

> **Estado atual:** o Compose corre a aplicação completa. `servidor1` e `servidor2` usam
> a imagem de [`../Backend`](../Backend/README.md), e o nginx encaminha `/api/` para
> essas instâncias. O `../Frontend` corre no Live Server, em `127.0.0.1:5500`.

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
| `trustvote-servidor1` | `servidor1` | `trustvote-backend` (de `../Backend`) | Instância 1 da aplicação |
| `trustvote-servidor2` | `servidor2` | `trustvote-backend` (de `../Backend`) | Instância 2, independente da 1 |
| `trustvote-monitor` | `monitor` | `trustvote-backend` | Failover automático da BD |
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
├── compose.debug.yaml            # OPCIONAL: publica a BD em 127.0.0.1:15432/15433 e o pgAdmin em :5050
├── .env.example                  # variáveis necessárias (valores ilustrativos)
├── .gitignore                    # exclui .env e ficheiros locais
├── .gitattributes                # força LF nos scripts (correm em Linux)
├── README.md
└── docker/
    ├── nginx/default.conf                  # upstream, deteção de falhas, logs
    ├── pgadmin/servers.json                # servidores pré-registados no pgAdmin (modo debug)
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
- Portas livres no anfitrião: `8080` (nginx). Opcional: `15432`, `15433`, `5050` (modo debug)

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

O mesmo comando arranca um **pgAdmin em contentor** em <http://127.0.0.1:5050>, sem login e com o
primário e a réplica já registados no grupo *TrustVote*. A password pedida ao abrir cada servidor é
`TRUSTVOTE_DB_PASSWORD`. Os servidores só são importados na primeira execução: depois de alterar
`docker/pgadmin/servers.json`, remover o volume `trustvote_pgadmin-data`.

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
- **Deteção passiva:** 2 falhas em 5 s (`max_fails=2 fail_timeout=5s`) retiram a instância
  durante 5 s; depois volta a ser experimentada automaticamente.
- **Reencaminhamento:** em erro de ligação, timeout (2 s a ligar, 4 s a responder) ou 502,
  o pedido é repetido na outra instância (`proxy_next_upstream`). Pedidos **não idempotentes**
  (ex.: `POST` de um voto) que já chegaram a uma instância **não** são repetidos, para evitar
  votos duplicados.
- **Resolução DNS dinâmica** (`resolver 127.0.0.11` + `resolve`): uma instância recriada com
  IP novo volta a receber pedidos sem reiniciar o nginx.
- O nginx arranca mesmo com uma instância em baixo (depende só de `service_started`).
- Cada contentor tem *healthcheck* em `GET /health` → `docker compose ps` mostra `unhealthy`.

**Verificar que ambos recebem pedidos:**
```powershell
1..10 | % { (Invoke-WebRequest http://127.0.0.1:8080/api/health -UseBasicParsing).Headers['X-Upstream-Server'] }
docker compose logs nginx      # cada linha mostra upstream=<ip:porta> e upstream_status
```

**Simular falha / substituir uma instância sem tocar no resto:**
```powershell
docker compose stop servidor1                                  # falha simulada
docker compose start servidor1                                 # recuperação
docker compose up -d --no-deps --force-recreate servidor2      # substituir contentor (nova imagem, etc.)
```

---

## 7. Replicação e failover do PostgreSQL

### Como funciona
- Replicação **física em streaming** (`wal_level=replica`), **síncrona enquanto a réplica estiver
  ativa**: um voto só é confirmado depois de estar nos dois nós.
- A réplica é **só de leitura** (`hot_standby`). Só existe um nó a aceitar escritas.
- A API recebe os dois nós em `DATABASE_HOST` e usa o que aceita escritas
  (`target_session_attrs=read-write`), por isso não precisa de reiniciar depois de um failover.
- Um **slot de replicação** impede o primário de apagar WAL que a réplica ainda não recebeu,
  até 1 GB (`max_slot_wal_keep_size`). Volumes separados: `pg-primary-data` e `pg-replica-data`.

### Monitor de failover (`docker/monitor/monitor.py`)
Verifica os dois nós pela rede de segundo a segundo, sem depender do Docker:

| Situação | Ação |
|---|---|
| Réplica ativa | Mantém a replicação síncrona |
| Réplica em baixo há ~2 verificações | Passa a assíncrona, para as escritas não bloquearem |
| Primário em baixo há 3 verificações e réplica síncrona | **Promove a réplica** |
| Primário em baixo e réplica não síncrona | **Recusa promover**: a votação para, sem perder votos |
| Dois primários | Cerca e para o da linha temporal mais antiga |

O monitor guarda o estado em memória. Se reiniciar com o primário em baixo, não promove, porque
não sabe se a réplica estava síncrona.

### Antigo primário
`docker/postgres/pg-entrypoint.sh` compara o nó com o outro antes de arrancar. Se este tiver dados
de primário e o outro já for primário numa linha temporal mais recente, os dados locais são
**apagados** e o nó é clonado como réplica. Se não houver linha temporal mais recente, recusa
arrancar (mensagem `RECUSADO` no log).

**Verificar:**
```powershell
.\.venv\Scripts\python.exe Infraestrutura\demo\estado.py   # papel, votos e replicação de cada nó
docker logs -f trustvote-monitor
```

### Testes de falha
Com a stack e os dados de demonstração a correr:
```powershell
.\.venv\Scripts\python.exe Infraestrutura\testes\teste_falhas.py bd-kill 300
```
Cenários: `api-kill`, `api-pause`, `bd-kill`, `bd-pause` e `replica-kill`. O teste falha se os votos
guardados não coincidirem com os confirmados nos dois nós. Cria dados de teste.

### Backups
```powershell
.\.venv\Scripts\python.exe Infraestrutura\demo\backup.py
```
Faz uma cópia com `pg_dump` para `Infraestrutura/backups/` e confirma-a numa BD temporária. A
replicação não substitui backups, porque os erros lógicos também são replicados.

### Limitações conhecidas
- **Registo aberto:** qualquer pessoa pode criar conta e fica habilitada a votar.
- **Um único PC:** todos os servidores são contentores na mesma máquina.
- **O nginx é um ponto único de falha.** O monitor também: sem ele, a votação continua, mas não há
  novos failovers nem mudança para replicação assíncrona.
- **Sem réplica, os votos não têm proteção síncrona:** se o primário perder o disco nesse período,
  os votos gravados depois da queda da réplica perdem-se.
- **Recibo perdido:** se a falha ocorrer depois de gravar e antes de responder, o voto conta, mas o
  recibo não pode ser recuperado.
- **Escritas durante a falha:** a API responde `503` até haver novo primário e o eleitor tem de
  repetir o voto. Durante a passagem para assíncrona, uma escrita pode terminar em `504` e o voto
  contar na mesma.

---

## 8. Segurança e portas

| Serviço | Porta interna | Publicada no anfitrião |
|---|---|---|
| nginx | 80 | `127.0.0.1:8080` (configurável no `.env`) |
| servidor1 / servidor2 | 8080 | não |
| db-primary / db-replica | 5432 | não (só com `compose.debug.yaml`: `127.0.0.1:15432/15433`) |
| pgadmin | 80 | só com `compose.debug.yaml`: `127.0.0.1:5050` |
| redis | 6379 | não |

- PostgreSQL e Redis só são acessíveis dentro da `trustvote-network`.
- Credenciais apenas no `.env` (ignorado pelo git); o `compose.yaml` só tem referências `${...}`.
- Replicação só aceite da sub-rede Docker (`pg_hba`: `host replication replicator samenet scram-sha-256`).
- Redis com password, `protected-mode`, e `FLUSHALL`/`FLUSHDB`/`DEBUG` desativados.
- Sem IPs fixos: os serviços comunicam por nome (DNS do Docker).

---

## 9. Integração com o backend e o frontend

- A âncora `x-app` do `compose.yaml` constrói a imagem de `../Backend`; aplica-se com
  `docker compose up -d --build --wait`.
- As instâncias recebem as variáveis `DATABASE_*`, `APP_INSTANCE` e `JWT_SECRET`, que tem
  de ser igual em ambas para um token valer em qualquer uma.
- O nginx encaminha `/api/` para as instâncias, sem o prefixo: `/api/eleicoes` chega à API
  como `/eleicoes`. As páginas são servidas pelo Live Server.
- O browser chama sempre o nginx (`http://127.0.0.1:8080`), nunca as instâncias diretamente.
- As instâncias são stateless: os tokens são JWT, não há sessão em memória.

---

## 10. Resultados dos testes (18/10/2026, Docker Engine 29.8.2)

Executados neste PC. "Placeholder" = testado com o servidor de substituição, **não** com o backend.

**Falhas com a aplicação real (31/10/2026):** 300 eleitores a votar e falha provocada a meio, com
`Infraestrutura/testes/teste_falhas.py`.

| Cenário | Votos guardados | Efeito nos eleitores |
|---|---|---|
| `bd-kill` (primária morta) | 300/300 nos dois nós | 7,6 s com `503`; 6 eleitores repetiram |
| `bd-pause` (primária congelada) | 300/300 nos dois nós | 9,8 s com `504`/`502`; 6 eleitores repetiram |
| `replica-kill` | 300/300 nos dois nós | Sem erros |
| `api-kill` | 300/300 nos dois nós | Sem erros |
| `api-pause` | 300/300 nos dois nós | 7 eleitores receberam `504` ao fim de 4 s e repetiram |

Casos-limite verificados: primária morta com a réplica desatualizada (promoção recusada, API a
responder `503`); congelada que acorda como segundo primário (cercada e reconstruída); reinício
completo com papéis trocados; instalação nova com volumes vazios.

A repetição de um voto é segura, porque a restrição única recusa o segundo voto com `409`. Num
teste anterior, um eleitor ficou com o voto contado mas sem recibo.

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

### Pendentes (dependem do backend dos colegas)
- Balanceamento e failover **com a aplicação real** (sessões, pedidos longos, `POST` de votos).
- Comportamento das aplicações durante a promoção da BD (reconexão ao novo `DATABASE_HOST`).
- Uso real do Redis (filas/cache) e leituras na réplica.
