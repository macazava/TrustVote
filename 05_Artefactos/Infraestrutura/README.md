# TrustVote — Infraestrutura Docker (ambiente local)

Infraestrutura para executar o TrustVote — **votações da Associação de Estudantes de
uma universidade europeia** — **num único PC Windows** com Docker Desktop, organizada
como **dois servidores** e um **árbitro** de failover.

## Arranque rápido (num PC novo)

Só é preciso o **Docker Desktop** a correr. Na pasta `05_Artefactos\Infraestrutura`:

```powershell
.\stack.cmd up
```

Na primeira vez demora alguns minutos (descarrega as imagens e constrói a API). O `up`:

1. cria o `.env` com passwords aleatórias, se ainda não existir;
2. arranca os dois servidores e o árbitro, e espera que fiquem todos saudáveis;
3. cria os dados de demonstração, se a base de dados estiver vazia.

No fim abre <http://127.0.0.1:8080>. Este endereço continua a funcionar com qualquer um dos
servidores em baixo: a entrada passa sozinha para o que estiver de pé. Contas:

| Conta | E-mail | Palavra-passe |
|---|---|---|
| Equipa | `equipa@trustvote.pt` | `Demonstracao2026` |
| Eleitores | `eleitor01@trustvote.pt` a `eleitor20@trustvote.pt` | `Demonstracao2026` |

Para parar: `.\stack.cmd down` (os dados ficam guardados). Depois de mudar código do
Backend: `.\stack.cmd up -Build`. O `stack.cmd` só chama o `stack.ps1`, sem depender da
política de execução de scripts do PowerShell.

---

## 1. Arquitetura

```
                     Eleitor (browser) ── http://127.0.0.1:8080
                                    │
                     entrada (árbitro): envia para o servidor que estiver de pé
               ┌────────────────────┴────────────────────┐
   ┌───────────▼──── SERVIDOR 1 ────────┐   ┌─────────────▼── SERVIDOR 2 ─────────┐
   │  nginx1 ──┬──► servidor1 ◄─────────┼───┼── (recurso)      nginx2             │
   │           └────────────────────────┼───┼──► servidor2 ◄────┘                 │
   │                                    │   │                                     │
   │  worker ── lê a fila ──► redis ════════ replicação ═════► redis-replica      │
   │     │                              │   │   worker-reserva (assume se o       │
   │     ▼ apuramento                   │   │   worker cair)                      │
   │  db-primary ═══ replicação síncrona ═══┼══► db-replica                       │
   │  sentinel1                         │   │   sentinel2                         │
   └────────────────────────────────────┘   └─────────────────────────────────────┘
                     ▲   monitor + sentinel3 (árbitro, projeto à parte)   ▲
                     └──────── vigiam os dois nós da BD e do Redis ───────┘
   Todos os contentores estão na rede Docker partilhada trustvote-network (172.30.0.0/24).
```

Tudo está num só ficheiro, [`compose.yaml`](compose.yaml) (projeto `trustvote`). Os
"servidores" são grupos de serviços dentro dele:

| Grupo | Contentores |
|---|---|
| Servidor 1 | `trustvote-nginx1`, `trustvote-servidor1`, `trustvote-worker`, `trustvote-db-primary`, `trustvote-redis`, `trustvote-sentinel1` |
| Servidor 2 | `trustvote-nginx2`, `trustvote-servidor2`, `trustvote-worker-reserva`, `trustvote-db-replica`, `trustvote-redis-replica`, `trustvote-sentinel2` |
| Árbitro | `trustvote-entrada`, `trustvote-monitor`, `trustvote-sentinel3` |

Para simular a queda de um servidor inteiro: `.\stack.cmd parar 1` (ou `2`); para o
voltar a ligar: `.\stack.cmd ligar 1`.

| Contentor | Imagem | Função |
|---|---|---|
| `entrada` | `nginx:1.28-alpine` | Único endereço do site (8080). Envia para o `nginx1` ou o `nginx2` e, se um servidor cair, passa sozinha para o outro (`docker/nginx/entrada.conf.template`) |
| `nginx1` / `nginx2` | `nginx:1.28-alpine` | Servem o site (pasta `Frontend`) e a API em `/api`, com balanceamento. O Nginx 1 reparte por `servidor1` e `servidor2` (round-robin); o Nginx 2 envia para o `servidor2` e só usa o `servidor1` de recurso |
| `servidor1` / `servidor2` | `trustvote-backend` (de `../Backend`) | Instâncias da API. Com `APURAMENTO=worker`, encerrar uma volta só fecha a votação e põe o apuramento na fila |
| `worker` / `worker-reserva` | `trustvote-backend` (`python -m app.worker`) | Apuramento e tarefas automáticas (iniciar eleições, abrir/fechar voltas). Só um trabalha; ver secção 7 |
| `db-primary` / `db-replica` | `postgres:16` | PostgreSQL primário e réplica síncrona; trocam de papel num failover |
| `redis` / `redis-replica` | `redis:7.4-alpine` | Fila de apuramento, sessões terminadas e tentativas de login. Principal e réplica; trocam de papel num failover. **Não** é fonte de verdade |
| `sentinel1` / `sentinel2` / `sentinel3` | `redis:7.4-alpine` | Redis Sentinel: vigiam o Redis principal e promovem a réplica se ele cair (quórum 2 de 3; ver secção 7) |
| `monitor` | `trustvote-backend` | Failover da BD. Fica fora dos dois servidores (ver secção 8) |

### Níveis de redundância

| Nível | O que existe aqui | Protege contra | **Não** protege contra |
|---|---|---|---|
| Entrada | Balanceador de entrada (8080) à frente dos 2 nginx | Queda de um nginx ou de um servidor inteiro, mesmo ao abrir ou recarregar a página | Queda do árbitro |
| Aplicação | 2 instâncias da API atrás de cada nginx | Falha/paragem de uma instância | — |
| Apuramento | Worker + Worker Reserva com liderança na BD | Queda do worker | Queda dos dois (a votação continua, o apuramento espera) |
| Redis | Principal + réplica + 3 Sentinels (um por servidor e um no árbitro) | Queda do Redis principal ou de um servidor inteiro | Queda dos dois Redis (a votação continua; perde-se o logout imediato e o limite de login) |
| Dados | Réplica PostgreSQL síncrona + monitor | Perda do primário, sem perder votos confirmados | Erros lógicos (um `DELETE` errado é replicado) |
| Máquina física | **Nenhuma** | — | Avaria do PC, disco, Docker Desktop ou Windows: **tudo para** |

Os "servidores" são grupos de contentores no mesmo PC: partilham disco e motor Docker.
Servem para mostrar e testar a queda de um servidor inteiro (secção 9).

---

## 2. Estrutura dos ficheiros

```
05_Artefactos/Infraestrutura/
├── compose.yaml                      # toda a infraestrutura: Servidor 1, Servidor 2 e árbitro
├── stack.cmd / stack.ps1             # arranca/para tudo pela ordem certa (usar o stack.cmd)
├── .env.example                      # variáveis necessárias (valores ilustrativos)
├── demo/  testes/  backups/          # guião, dados e estado da demo · testes de falha · cópias
└── docker/
    ├── nginx/default.conf.template         # site, API, upstream, deteção de falhas, logs
    ├── monitor/monitor.py                  # failover da BD
    ├── pgadmin/servers.json                # servidores pré-registados no pgAdmin (modo debug)
    ├── postgres/pg-entrypoint.sh           # entrypoint comum: primário ou réplica (pg_basebackup)
    ├── redis/redis.conf                    # persistência AOF, limites, comandos perigosos desativados
    └── redis/arranque.sh                   # arranque do Redis (principal ou réplica) e dos Sentinels
```

O **esquema da base de dados** não é duplicado aqui: é montado de
`05_Artefactos/Backend/basedados/trustvote.sql`, um só ficheiro com as contas, a autorização
da réplica e as tabelas.

---

## 3. Requisitos

- Windows 10/11 com **WSL 2** e **Docker Desktop** (testado com Docker Engine 29.8 / Compose v5.5)
- Portas livres no anfitrião: `8080` (entrada), `8081` (Nginx 1) e `8082` (Nginx 2). Se uma
  estiver ocupada, mudar `ENTRADA_PORT`/`NGINX1_PORT`/`NGINX2_PORT` no `.env`. Opcional: `15432`, `15433`, `5050` (modo debug). A `9080` não é usada porque o
  `NahimicService` (áudio) a ocupa em muitos PCs.

## 4. Configurar o `.env`

O `.\stack.cmd up` cria-o na primeira vez, a partir do `.env.example`, com passwords
aleatórias. Cada PC tem o seu; o `.env` não vai para o git.

| Variável | Uso |
|---|---|
| `POSTGRES_PASSWORD` | superutilizador `postgres` (administração) |
| `TRUSTVOTE_DB_PASSWORD` | utilizador `trustvote`, usado pela API e pelos workers |
| `REPLICATION_PASSWORD` | utilizador `replicator` (primário → réplica) |
| `REDIS_PASSWORD` | autenticação do Redis |
| `JWT_SECRET`, `VOTO_HMAC_SECRET` | segredos da API, iguais em todas as instâncias |
| `NGINX_BIND_ADDRESS`, `ENTRADA_PORT`, `NGINX1_PORT`, `NGINX2_PORT` | onde a entrada e os nginx são publicados (por defeito `127.0.0.1`, 8080, 8081 e 8082) |
| `TAREFAS_INTERVALO` | segundos entre ciclos do worker (por defeito 30) |

As passwords só são lidas quando a base de dados é criada (volume vazio): mudá-las depois
não muda as que já estão na base de dados.

---

## 5. Site, API e portas

Tudo funciona em HTTP, sem certificados. **Usa-se sempre a entrada**:

| | Site | Documentação da API |
|---|---|---|
| **Entrada** (passa sozinha para o servidor de pé) | <http://127.0.0.1:8080> | <http://127.0.0.1:8080/api/docs> |
| Nginx 1, só o Servidor 1 | <http://127.0.0.1:8081> | <http://127.0.0.1:8081/api/docs> |
| Nginx 2, só o Servidor 2 | <http://127.0.0.1:8082> | <http://127.0.0.1:8082/api/docs> |

Com um servidor inteiro em baixo (`.\stack.cmd parar 1`), o `8080` continua a abrir o site e a
API pelo outro: a entrada percebe em ~1 s que o servidor não responde e deixa de o usar durante
5 s, voltando a experimentá-lo depois. Os dois nginx e as duas APIs têm IPs fixos
(`172.30.0.31/32` e `.41/.42`), para nunca se tentar o endereço antigo de um contentor que caiu.
Um `POST` (ex.: um voto) que já chegou a um servidor nunca é repetido no outro.

**Links das portas no Docker Desktop:**

| Porta | O que acontece |
|---|---|
| `8080` (entrada), `8081`, `8082` (nginx) | Abre o site |
| `5050` (pgAdmin, com `-Dev`) | Abre o pgAdmin |
| `15432`, `15433` (com `-Dev`) | São o PostgreSQL, não páginas web: no browser dão "resposta vazia", o que é normal. Abrem-se no pgAdmin, no DBeaver ou no IntelliJ |

---

## 6. Comandos

```powershell
.\stack.cmd up              # arranca tudo (1.ª vez: cria o .env e os dados de demonstração)
.\stack.cmd up -Build       # idem, reconstruindo a API depois de mudar código do Backend
.\stack.cmd up -Dev         # idem, e arranca também o pgAdmin (5050)
.\stack.cmd ps              # estado de todos os contentores
.\stack.cmd logs worker     # seguir os logs de um contentor
.\stack.cmd demo            # criar os dados de demonstração (só numa BD vazia)
.\stack.cmd down            # parar e remover os contentores (mantém os dados)
.\stack.cmd parar 1         # simular a queda do Servidor 1 inteiro (ou 2)
.\stack.cmd ligar 1         # voltar a ligá-lo
```

Para simular falhas:

```powershell
.\stack.cmd parar 2                     # o Servidor 2 inteiro cai
.\stack.cmd ligar 2                     # e volta
docker compose restart servidor1        # só a API do Servidor 1
```

Os volumes têm nomes fixos (`trustvote_pg-primary-data`, `trustvote_pg-replica-data`,
`trustvote_redis-data`, `trustvote_redis-replica-data`, `trustvote_pgadmin-data`), para manter
os dados de quem já tinha o projeto a correr.

### Ver a base de dados num cliente (IntelliJ Database, DBeaver, pgAdmin)

As bases de dados estão sempre publicadas só neste PC; o pgAdmin só com `.\stack.cmd up -Dev`:

| | Host | Porta | BD | Utilizador | Password |
|---|---|---|---|---|---|
| `db-primary` | `127.0.0.1` | `15432` | `trustvote` | `trustvote` | `TRUSTVOTE_DB_PASSWORD` do `.env` |
| `db-replica` | `127.0.0.1` | `15433` | `trustvote` | `trustvote` | idem |

O pgAdmin fica em <http://127.0.0.1:5050>, sem login e com os dois nós registados.

### Scripts de inicialização só correm com volume vazio

O `trustvote.sql` **só corre quando o volume do PostgreSQL está vazio**. Numa base de dados
que já existe, uma alteração ao esquema faz-se à mão (ver o README do Backend, secção 7).

---

## 7. Balanceamento, worker e fila

**Nginx** (`docker/nginx/default.conf.template`, comum aos dois):

- Deteção passiva: 2 falhas em 5 s retiram a instância durante 5 s.
- Em erro de ligação, timeout (2 s a ligar, 4 s a responder) ou 502, o pedido passa para a
  outra instância. Pedidos **não idempotentes** (ex.: `POST` de um voto) que já chegaram a uma
  instância **não** são repetidos, para evitar votos duplicados.
- Cabeçalhos `X-Nginx` e `X-Upstream-Server` mostram que nginx e que instância responderam.
- Resolução DNS dinâmica: uma instância recriada volta a receber pedidos sem reiniciar o nginx.

**Frontend** (`Frontend/js/models/servidor.js`): usa o Nginx 1 e, se a ligação falhar, passa
para o Nginx 2 e fica lá. Só muda quando não há resposta nenhuma; um pedido que recebeu
resposta, mesmo de erro, nunca é repetido no outro.

**Worker** (`../Backend/app/worker.py`):

1. A API, ao encerrar uma volta (ou a eleição), fecha a votação (`encerrada`) e põe o id da
   volta na fila `tv:fila:apuramento` do Redis.
2. O worker líder tira-o da fila, apura (selos, brancos, `resultado`) e marca a volta `apurada`.
   Fica na auditoria como "Volta apurada", feito pelo Sistema.
3. A cada `TAREFAS_INTERVALO` segundos corre as tarefas automáticas e apura as voltas
   `encerrada` que tenham ficado para trás. Por isso, um pedido perdido (Redis em baixo) é
   apurado no ciclo seguinte.

**Liderança:** só trabalha quem tiver um advisory lock no PostgreSQL, preso a uma ligação
aberta. O `worker` (principal) tem prioridade: o `worker-reserva` só disputa o lock enquanto o
principal não estiver a correr, e devolve-o quando ele volta. Se o líder parar ou perder a BD,
a ligação fecha-se, o lock fica livre e o outro assume em ~3 s. O papel atual está em
`/tmp/worker-estado` (usado pelo healthcheck e pelo `demo/estado.py`).

**Redis com Sentinel:** há um Redis em cada servidor (`redis` e `redis-replica`) e três
Sentinels: `sentinel1` no Servidor 1, `sentinel2` no Servidor 2 e `sentinel3` no árbitro, ao
lado do monitor.

- A API e os workers não ligam a um Redis fixo: perguntam aos Sentinels qual é o principal
  (`REDIS_SENTINELS`). Depois de um failover, a ligação seguinte já vai para o novo principal.
- Se o principal deixar de responder durante 3 s, os Sentinels que restam (2 de 3) promovem a
  réplica em ~5 s. Por isso a queda de um servidor inteiro nunca impede o failover.
- Um Redis que volta (`docker/redis/arranque.sh`) pergunta primeiro aos Sentinels quem é o
  principal e entra como réplica dele, em vez de se declarar principal outra vez.
- Os Sentinels e os Redis têm **IPs fixos** (`172.30.0.11/12` e `.21/.22/.23`): o Sentinel resolve
  nomes de forma síncrona e, com um servidor em baixo, cada nome que já não existe bloqueava-o
  ~1 s, o que o punha em modo TILT, sem failover. Os outros contentores recebem IPs de
  `172.30.0.128/25`, por isso nunca colidem. A rede é criada pelo Compose com esta sub-rede (ver `compose.yaml`).
- A replicação do Redis é assíncrona: um pedido de apuramento acabado de pôr na fila pode
  perder-se no failover, mas o worker apura-o na verificação seguinte (passo 3 acima).

**Os dois Redis em baixo:** a API deixa de o usar depois da primeira falha e testa-o em
segundo plano até voltar. Perde-se o logout imediato, o limite de tentativas e a fila, mas não
a votação.

---

## 8. Replicação e failover do PostgreSQL

### Como funciona
- Replicação **física em streaming**, **síncrona enquanto a réplica estiver ativa**: um voto só
  é confirmado depois de estar nos dois nós.
- A réplica é **só de leitura**; as páginas públicas leem dela. A API recebe os dois nós em
  `DATABASE_HOST` e usa o que aceita escritas, por isso não precisa de reiniciar no failover.
- Um **slot de replicação** impede o primário de apagar WAL que a réplica ainda não recebeu.

### Monitor de failover (`docker/monitor/monitor.py`)

| Situação | Ação |
|---|---|
| Réplica ativa | Mantém a replicação síncrona |
| Réplica em baixo há ~2 verificações | Passa a assíncrona, para as escritas não bloquearem |
| Primário em baixo há 3 verificações e réplica síncrona | **Promove a réplica** |
| Primário em baixo e réplica não síncrona | **Recusa promover**: a votação para, sem perder votos |
| Dois primários | Cerca e para o da linha temporal mais antiga |

O monitor fica **fora dos dois servidores** (é o "árbitro" do `compose.yaml`), de propósito. No Servidor 1, a queda
desse servidor levava o monitor e não havia failover. No Servidor 2, a queda deixava o primário
em modo síncrono à espera de uma réplica que já não existe, e as escritas bloqueavam.

### Antigo primário
`docker/postgres/pg-entrypoint.sh` compara o nó com o outro antes de arrancar. Se este tiver
dados de primário e o outro já for primário numa linha temporal mais recente, os dados locais
são **apagados** e o nó é clonado como réplica; senão recusa arrancar (`RECUSADO` no log). A
linha temporal do outro nó é lida do ficheiro de WAL em uso, que muda logo na promoção (a do
último checkpoint só mudava no checkpoint seguinte, o que fazia o nó recusar várias vezes).

### Testes de falha
Com a stack e os dados de demonstração a correr (`.\stack.cmd up`):
```powershell
.\.venv\Scripts\python.exe Infraestrutura\testes\teste_falhas.py bd-kill 300
```
Cenários: `api-kill`, `api-pause`, `bd-kill`, `bd-pause` e `replica-kill`. O teste falha se os votos
guardados não coincidirem com os confirmados nos dois nós. Cria dados de teste.

### Backups
```powershell
.\.venv\Scripts\python.exe Infraestrutura\demo\backup.py
```
Faz uma cópia com `pg_dump` para `Infraestrutura/backups/` e confirma-a numa BD temporária.

### Limitações conhecidas
- **Um único PC:** os "servidores" são grupos de contentores na mesma máquina.
- **O monitor é um ponto único de falha para novos failovers** (a votação continua sem ele).
- **Janela de failover:** entre a queda do servidor com os nós principais e a promoção (~10 s na
  BD, ~5 s no Redis), os pedidos que escrevem recebem `503` e o eleitor repete; nenhum pedido
  fica bloqueado mais de ~1,5 s.
- **O árbitro (monitor + `sentinel3`) é um ponto único para failovers seguintes** se cair ao
  mesmo tempo que um servidor: sem ele não há maioria de Sentinels nem monitor.
- **Sem réplica, os votos não têm proteção síncrona.**
- **Recibo perdido:** se a falha ocorrer depois de gravar e antes de responder, o voto conta, mas o
  recibo não pode ser recuperado.
- **Escritas durante a falha da BD:** a API responde `503` até haver novo primário e o eleitor tem
  de repetir o voto.

---

## 9. Segurança e portas

| Serviço | Porta interna | Publicada no anfitrião |
|---|---|---|
| entrada | 80 | `127.0.0.1:8080` (site e API, pelo servidor de pé) |
| nginx1 | 80 | `127.0.0.1:8081` (só o Servidor 1) |
| nginx2 | 80 | `127.0.0.1:8082` (só o Servidor 2) |
| servidor1 / servidor2 | 8080 | não |
| db-primary / db-replica | 5432 | não (só com `-Dev`: `127.0.0.1:15432/15433`) |
| pgadmin | 80 | só com `-Dev`: `127.0.0.1:5050` |
| redis / redis-replica | 6379 | não |
| sentinel1 / sentinel2 / sentinel3 | 26379 | não |

- PostgreSQL, Redis e Sentinels só são acessíveis dentro da `trustvote-network`.
- Sem HTTPS: o tráfego entre o browser e o nginx não é cifrado. Os nginx só estão publicados
  em `127.0.0.1` (este PC), por isso o tráfego não sai da máquina.
- Credenciais apenas no `.env` (ignorado pelo git); os ficheiros Compose só têm `${...}`.
- Replicação só aceite da sub-rede Docker (`pg_hba`: `host replication replicator samenet scram-sha-256`).
- Redis e Sentinels com password (a mesma, `REDIS_PASSWORD`), `protected-mode`, e
  `FLUSHALL`/`FLUSHDB`/`DEBUG` desativados.

---

## 10. Integração com o backend e o frontend

- `compose.yaml` constrói a imagem de `../Backend`; aplica-se com `.\stack.cmd up -Build`.
- As instâncias e os workers recebem as mesmas `DATABASE_*`, `REDIS_*`, `JWT_SECRET` e
  `VOTO_HMAC_SECRET`. As instâncias têm `APURAMENTO=worker` e `TAREFAS_INTERVALO=0`; o trabalho
  de fundo é dos workers.
- Os nginx encaminham `/api/` sem o prefixo: `/api/eleicoes` chega à API como `/eleicoes`.
- As instâncias são stateless: os tokens são JWT, não há sessão em memória.

---

## 11. Resultados dos testes

**04/11/2026 — queda de um servidor inteiro, como na apresentação** (Redis com Sentinel):

Com o servidor parado (`.\stack.cmd parar N`), tudo feito pelo outro nginx:
criar conta, login do administrador, habilitar, login e voto de 3 eleitores,
verificar recibo, voto repetido recusado, logout com o token revogado, bloqueio ao 6.º login
errado, encerrar a votação e ver os resultados.

| Cenário | Resultado |
|---|---|
| Servidor 1 parado (BD primária e Redis principal nele) | ✅ todas as verificações; BD e Redis promovidos; API pronta ~11 s depois; volta apurada pela fila em 0,3 s |
| Servidor 2 parado (com os nós principais nele) | ✅ idem; volta apurada em 0,2 s |
| Regresso do servidor | ✅ à primeira; BD volta como réplica síncrona, Redis como réplica, worker principal volta a liderar |
| Pedido apanhado no instante da queda | ✅ o mais lento demorou 1,5 s (antes do ajuste ao cliente dos Sentinels chegava a ~10 s e o nginx dava `504`) |

**04/11/2026 — dois servidores e worker** (Docker Engine 29.8, neste PC):

| Teste | Resultado |
|---|---|
| Fluxo completo pela API (42 verificações), pelo Nginx 1 e pelo Nginx 2 | ✅ sem falhas; volta apurada pelo worker 0,1 s depois de encerrada |
| Worker principal morto | ✅ reserva assume e apura; devolve a liderança quando o principal volta |
| Redis parado (antes do Sentinel) | ✅ API responde em centésimas (só o 1.º pedido espera ~1 s); volta apurada na verificação periódica |
| Servidor 1 inteiro parado | ✅ réplica promovida; votação e apuramento pelo Servidor 2; ao voltar, o antigo primário é reconstruído como réplica síncrona, sem recusas |
| Servidor 2 inteiro parado (com o primário nele) | ✅ idem, no sentido inverso |
| `teste_falhas.py api-kill 60` | ✅ 60/60 votos nos dois nós |
| `teste_falhas.py bd-kill 100` (2×, ida e volta) | ✅ 100/100 nos dois nós; 6–7,6 s com `503`; 6 eleitores repetiram |

**31/10/2026 — falhas com a aplicação real** (300 eleitores, arquitetura anterior):

| Cenário | Votos guardados | Efeito nos eleitores |
|---|---|---|
| `bd-kill` | 300/300 nos dois nós | 7,6 s com `503`; 6 eleitores repetiram |
| `bd-pause` | 300/300 nos dois nós | 9,8 s com `504`/`502`; 6 eleitores repetiram |
| `replica-kill` | 300/300 nos dois nós | Sem erros |
| `api-kill` | 300/300 nos dois nós | Sem erros |
| `api-pause` | 300/300 nos dois nós | 7 eleitores receberam `504` ao fim de 4 s e repetiram |

A repetição de um voto é segura, porque a restrição única recusa o segundo voto com `409`.
