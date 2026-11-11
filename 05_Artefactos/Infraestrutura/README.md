# TrustVote — Infraestrutura Docker (ambiente local)

Infraestrutura para executar o TrustVote — **votações da Associação de Estudantes de
uma universidade europeia** — **num único PC Windows** com Docker Desktop:
balanceador de carga, duas instâncias da aplicação, PostgreSQL com réplica e Redis.

> Para a visão geral do projeto e como pôr tudo a funcionar, começa pelo
> [README da raiz](../README.md). Este documento detalha apenas a infraestrutura.

> **Estado atual:** o Compose executa a stack da aplicação. `servidor1` e `servidor2` usam
> a imagem de [`../Backend`](../Backend/README.md), e o nginx serve o `../Frontend` por HTTPS
> e encaminha `/api/` para essas instâncias. O Live Server em `127.0.0.1:5500`
> continua disponível para desenvolvimento local.

### Navegação

- [Arquitetura e serviços](#1-arquitetura)
- [Requisitos e configuração](#3-requisitos)
- [HTTPS local e arranque](#5-https-local)
- [Comandos do dia a dia](#6-comandos)
- [Balanceamento e failover](#7-balanceamento-e-falha-de-uma-instância)
- [Segurança e portas](#9-segurança-e-portas)
- [Integração frontend/backend](#10-integração-com-o-backend-e-o-frontend)
- [Resultados e trabalho por fazer](#11-resultados-dos-testes)

---

## 1. Arquitetura

```
                      Windows — um único PC
 Browser
   | HTTPS :8443 (frontend + API)
   | HTTP :8080 (redireciona para HTTPS)
   v
 Nginx (TLS, ficheiros do frontend, balanceamento de /api)
   | /api
   +----------+----------+
   v                     v
 servidor1             servidor2
   +----------+----------+
              v
 PostgreSQL primário -- WAL --> réplica PostgreSQL
              ^
           monitor

 Redis (configurado na stack; ainda não usado pela API)
```

| Contentor | Serviço | Imagem | Função |
|---|---|---|---|
| `trustvote-nginx` | `nginx` | `nginx:1.28-alpine` | Termina TLS, serve o frontend e balanceia pedidos da API |
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
| Replicação de dados | PostgreSQL em streaming; síncrona com a réplica ativa e assíncrona durante indisponibilidade | Perda do contentor/volume do primário | Erros lógicos (um `DELETE` errado é replicado); perda do PC/disco |
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
    ├── nginx/default.conf                  # HTTPS, redirecionamento, upstream e logs
    ├── nginx/certs/                        # certificados locais (ignorada pelo Git)
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
- Portas livres no anfitrião: `8080` (HTTP, redireciona para HTTPS) e `8443` (HTTPS). Opcional:
  `15432`, `15433`, `5050` (modo debug)

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
| `NGINX_BIND_ADDRESS` / `NGINX_HTTP_PORT` | endereço e porta HTTP do Nginx (por defeito `127.0.0.1:8080`; HTTPS usa `8443`) |
| `DB_WRITE_HOST`, `DB_READ_HOST`, `DB_*_NODE_ROLE`, `DB_*_UPSTREAM` | só para o failover manual (secção 8) |

O `docker compose` recusa arrancar se faltar alguma password.

## 5. HTTPS local

O Nginx serve o frontend e a API por HTTPS em `https://127.0.0.1:8443`; a porta HTTP
`8080` redireciona para HTTPS. Para desenvolvimento local, cada pessoa deve gerar o seu
próprio certificado com `mkcert`; não partilhe nem faça commit da chave privada. No Windows,
instale o `mkcert` (por exemplo,
`winget install --id FiloSottile.mkcert -e`) e, a partir desta pasta `Infraestrutura`, execute:

```powershell
mkcert -install
New-Item -ItemType Directory -Force .\docker\nginx\certs
mkcert -cert-file .\docker\nginx\certs\cert.pem `
  -key-file .\docker\nginx\certs\key.pem `
  localhost 127.0.0.1 ::1
```

`mkcert -install` adiciona a autoridade certificadora local à confiança do utilizador neste
computador. Os certificados e a chave são ignorados pelo Git. O certificado é local e não
torna o site publicamente confiável nem deve ser copiado para outros computadores ou
dispositivos móveis.

Depois de configurar o `.env` e gerar os certificados:

```powershell
docker compose up -d --build --wait
```

Confirme o redirecionamento HTTP e o acesso HTTPS ao frontend e à API:

```powershell
curl.exe -I http://127.0.0.1:8080/
Invoke-WebRequest https://127.0.0.1:8443/pages/inicio.html -UseBasicParsing |
  Select-Object StatusCode
Invoke-RestMethod https://127.0.0.1:8443/api/health
```

O primeiro comando deve mostrar `301 Moved Permanently` e `Location:
https://127.0.0.1:8443/`. O segundo deve devolver `200`; o terceiro deve indicar
`"status":"ok"` e `"database":"ok"`. O endpoint `/nginx-health` é uma verificação simples
do Nginx, usada pelo healthcheck do contentor; não verifica a saúde da API nem da base de dados.

## 6. Comandos

```powershell
cd 05_Artefactos\Infraestrutura

# --- Subir ------------------------------------------------------------------
docker compose up -d --wait                  # 1ª vez, ou depois de alterar o compose.yaml
docker compose up -d --build --wait          # depois de alterar o Dockerfile/requirements.txt

# --- Ver --------------------------------------------------------------------
docker compose ps                            # estado + health
docker compose logs -f nginx                 # logs de um serviço (ou sem nome = todos)
docker compose logs --tail=60 servidor1 servidor2

# --- Operar -----------------------------------------------------------------
docker compose restart servidor1             # reiniciar só uma instância
docker compose start servidor1               # voltar a arrancar (após stop)

# --- Parar ------------------------------------------------------------------
docker compose stop                          # parar (mantém contentores e dados)
docker compose down                          # remover contentores (mantém volumes/dados)
docker compose down --remove-orphans         # idem, e remove contentores órfãos
docker compose down -v                       # APAGA TAMBÉM OS DADOS (volumes)
```

### Duas regras que evitam quase todos os problemas

**1. `--build` sempre que mudar o `Dockerfile` ou o `requirements.txt`.**
O Compose reutiliza a imagem `trustvote-backend` que já existe no cache. Sem `--build`,
as alterações ao backend não entram nos contentores — já aconteceu a imagem ter ficado
com uma porta antiga, deixando o nginx a devolver `502` sem razão aparente.

**2. Descer com o mesmo conjunto de ficheiros com que se subiu.**
O `compose.debug.yaml` acrescenta o `pgadmin`. Se subires com ele e desceres só com o
`compose.yaml`, o pgAdmin sobrevive e a rede passa a dar `Resource is still in use`:

```powershell
# com debug
docker compose -f compose.yaml -f compose.debug.yaml up -d --wait
docker compose -f compose.yaml -f compose.debug.yaml down --remove-orphans
```

### Limpeza pontual

```powershell
docker network rm trustvote-network     # só depois de tudo removido (0 contentores ligados)
docker network ls                       # confirmar o que resta
docker rmi trustvote-backend            # forçar reconstrução total na próxima subida
```

### Portas ocupadas no anfitrião

Libertar a `8001` (API a correr fora do Docker, `Errno 10048`):

```powershell
Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

Se o `up` falhar com `port is already allocated`, ver quem detém a porta:

```powershell
Get-NetTCPConnection -LocalPort 8080 -State Listen |
  Select-Object LocalAddress, OwningProcess
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

## 7. Balanceamento e falha de uma instância

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
1..10 | % { (Invoke-WebRequest https://127.0.0.1:8443/api/health -UseBasicParsing).Headers['X-Upstream-Server'] }
docker compose logs nginx      # cada linha mostra upstream=<ip:porta> e upstream_status
```

**Simular falha / substituir uma instância sem tocar no resto:**
```powershell
docker compose stop servidor1                                  # falha simulada
docker compose start servidor1                                 # recuperação
docker compose up -d --no-deps --force-recreate servidor2      # substituir contentor (nova imagem, etc.)
```

---

## 8. Replicação e failover do PostgreSQL

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

## 9. Segurança e portas

| Serviço | Porta interna | Publicada no anfitrião |
|---|---|---|
| nginx | 80 | `127.0.0.1:8080` (configurável no `.env`; redireciona para HTTPS) |
| nginx | 443 | `127.0.0.1:8443` |
| servidor1 / servidor2 | 8080 | não |
| db-primary / db-replica | 5432 | não (só com `compose.debug.yaml`: `127.0.0.1:15432/15433`) |
| pgadmin | 80 | só com `compose.debug.yaml`: `127.0.0.1:5050` |
| redis | 6379 | não |

- PostgreSQL e Redis só são acessíveis dentro da `trustvote-network`.
- Credenciais apenas no `.env` (ignorado pelo git); o `compose.yaml` só tem referências `${...}`.
- O Nginx é publicado apenas em `127.0.0.1` por omissão. O certificado `mkcert` é local,
  não é confiável automaticamente por telemóveis e não se destina a acesso público.
- A porta HTTP redireciona para HTTPS, exceto o endpoint de healthcheck `/nginx-health`.
- Replicação só aceite da sub-rede Docker (`pg_hba`: `host replication replicator samenet scram-sha-256`).
- Redis com password, `protected-mode`, e `FLUSHALL`/`FLUSHDB`/`DEBUG` desativados.
- Sem IPs fixos: os serviços comunicam por nome (DNS do Docker).

---

## 10. Integração com o backend e o frontend

- A âncora `x-app` do `compose.yaml` constrói a imagem de `../Backend`; aplica-se com
  `docker compose up -d --build --wait` (o `--build` é o que garante que a imagem
  corresponde ao código atual).
- As instâncias recebem as variáveis `DATABASE_*`, `APP_INSTANCE` e `JWT_SECRET`, que tem
  de ser igual em ambas para um token valer em qualquer uma.
- O nginx serve as páginas do frontend e encaminha `/api/` para as instâncias, sem o
  prefixo: `/api/eleicoes` chega à API como `/eleicoes`.
- O browser chama o nginx, nunca as instâncias diretamente. Ao abrir pelo nginx, o frontend
  usa a API na mesma origem (`/api`); no Live Server local, usa `https://127.0.0.1:8443/api`.
- As instâncias são stateless: os tokens são JWT, não há sessão em memória.

### CORS no Live Server local

O backend autoriza, por omissão, `http://127.0.0.1:5500` **e** `http://localhost:5500`
(`CORS_ORIGINS`, ver [`../Backend/README.md`](../Backend/README.md)). Sem as duas, abrir
a aplicação por um dos nomes e apontar a API para o outro pode dar erro de CORS. Quando
frontend e API são servidos pelo nginx, ambos partilham a mesma origem e esta configuração
de CORS não é necessária para o navegador.

### `JWT_SECRET`: contentores vs. API local

- Os contentores recebem o `JWT_SECRET` do `.env` **desta** pasta.
- A API corrida localmente na porta `8001` lê o `Backend/.env`, que não define
  `JWT_SECRET`, e usa por isso o segredo de desenvolvimento.
- Consequência prática: **um token obtido em `https://127.0.0.1:8443` não é aceite em
  `localhost:8001`**, e vice-versa. Se precisares de alternar, define o mesmo valor nos
  dois `.env`.

---

## 11. Resultados dos testes

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
| 10 | Portas expostas | ✅ Nginx em `127.0.0.1:8080` (HTTP) e `127.0.0.1:8443` (HTTPS); BD só com `compose.debug.yaml`, em `127.0.0.1` |

### Ainda por exercitar

- **Uso real do Redis** (filas/cache): o backend recebe `REDIS_HOST`/`REDIS_PASSWORD`,
  mas ainda não os usa.
- **Leituras na réplica:** o `compose.yaml` passa `DATABASE_READ_HOST=db-replica`, mas o
  `app/database.py` ainda não o consome — todas as leituras vão ao nó que aceita escritas.
- **Reconexão das instâncias após promoção da BD** a meio de um pedido longo.

> Os testes 7 e 8 foram inicialmente feitos com um servidor de substituição e **já foram
> repetidos com a aplicação real** nos testes de falha de 31/10 (tabela acima).

**Validação HTTPS (11/11/2026, configuração local):**

| Verificação | Resultado |
|---|---|
| `docker compose config --quiet` | ✅ configuração válida |
| `docker compose run --rm --no-deps nginx nginx -t` | ✅ sintaxe Nginx válida e certificados carregados |
| `http://127.0.0.1:8080/` | ✅ `301` para `https://127.0.0.1:8443/` |
| `https://127.0.0.1:8443/pages/inicio.html` | ✅ `200` |
| `https://127.0.0.1:8443/api/health` | ✅ `200`, API e base de dados saudáveis |
