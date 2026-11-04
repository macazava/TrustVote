# Backend do TrustVote

API REST do TrustVote, construída com **FastAPI**, **SQLAlchemy** e **PostgreSQL**.
Serve as votações da **Associação de Estudantes de uma universidade europeia** e as
instâncias de aplicação e os workers definidos na infraestrutura Docker
([`../Infraestrutura/compose.yaml`](../Infraestrutura/compose.yaml)).

> Para a visão geral do projeto e como pôr tudo a funcionar, começa pelo
> [README da raiz](../README.md). Este documento detalha apenas o backend.

- **Porta por omissão:** `8001`
- **Ponto de entrada:** [`main.py`](main.py)
- **Documentação interativa:** <http://localhost:8001/docs>

---

## 1. Estado atual

### Implementado

| Área | Descrição |
|---|---|
| Autenticação | Registo de utilizadores (com **número de estudante**) e login real com **JWT (HS256)** e passwords em **Argon2** |
| Elegibilidade | **Auto-habilitação**: ao registar-se, o eleitor fica habilitado nas eleições ainda não encerradas (tabela `habilitacao`) |
| Gestão de eleições | `eleicao`, `candidato` (por **órgão social** e **lista**), `ronda`, `ronda_candidato` e `habilitacao`, com o ciclo rascunho → agendada → em curso → encerrada |
| Voto | Transação única em `participacao` + `voto`, um voto por volta, **voto em branco**, recibo verificável |
| Integridade | Cada voto leva um **selo HMAC-SHA256**; um voto alterado ou inserido fora da API não conta. `GET /eleicoes/{id}/integridade` compara também a urna com as participações |
| Apuramento | Ao encerrar uma volta, a contagem é gravada em `resultado` e a volta passa a `apurada`; com **quórum** configurável por eleição |
| Tarefas automáticas | [`app/tarefas.py`](app/tarefas.py): inicia eleições agendadas, abre a 2.ª volta e fecha/apura as voltas na hora de fim |
| Worker | [`app/worker.py`](app/worker.py) (`python -m app.worker`): no Docker, apura as voltas pedidas na fila do Redis e corre as tarefas automáticas; um worker principal e um de reserva, com liderança por advisory lock |
| Auditoria (RF11) | Todas as ações da equipa, logins e alterações de conta ficam em `auditoria`, numa **cadeia de hashes** verificável. Os votos nunca passam pela auditoria |
| Contas | Mudança de palavra-passe, reposição pelo administrador, **logout real** (token revogado no Redis) e limite de tentativas de login |
| Registo | Aberto por omissão; com `REGISTO_RESTRITO=true`, só os números da **lista oficial de inscritos** |
| Sondagem | Intenção de voto anónima (quem respondeu e o que respondeu em tabelas separadas), com projeção bayesiana |
| Autorização | Dependências `utilizador_atual` (401) e `exigir_administrador` (403) |
| Base de dados | Ligação ao PostgreSQL via SQLAlchemy; esquema aplicado pelos scripts SQL canónicos; leituras públicas na réplica |
| Erros | Exceções de negócio traduzidas automaticamente em `400` / `403` / `404` / `409` / `429` |
| Healthcheck | `GET /health` — devolve `503` sem acesso à BD; usado pelo Compose |
| Failover | `DATABASE_HOST` aceita vários nós e usa o que aceita escritas; BD indisponível dá `503` |
| Testes | `pytest` em [`app/testes/`](app/testes), num esquema isolado da BD de desenvolvimento |

---

## 2. Enquadramento: eleições da Associação de Estudantes

O TrustVote modela um **ato eleitoral** da Associação de Estudantes de uma
universidade europeia. Conceitos:

- **Eleição** (`eleicao`) — o ato eleitoral como um todo.
- **Órgãos sociais** — cada candidatura concorre a um órgão:
  `direcao` (Direção), `assembleia` (Assembleia Geral/Mesa) ou
  `conselho_fiscal` (Conselho Fiscal).
- **Candidaturas individuais** — cada candidato (`candidato`) concorre a título
  individual a um órgão, com `curso` e `ano` opcionais.
- **Rondas** (`ronda`) — 1.ª e 2.ª volta, com janela temporal própria.
- **Elegibilidade** — quem vota tem **número de estudante** validado
  (`ut_num_estudante`, único) e é **auto-habilitado** (`habilitacao`) no registo,
  para todas as eleições ainda não encerradas.

> Anonimato: `participacao` regista **quem** votou e `voto` registra **a escolha**,
sem ligação entre as duas — ver [secção 6](#6-base-de-dados).

---

## 3. Arquitetura em camadas

Cada domínio atravessa quatro camadas, sempre pela mesma ordem:

```
 pedido HTTP
     │
     ▼
 routers/       ← só HTTP: valida a entrada e devolve a resposta
     │
     ▼
 services/      ← regras de negócio; levanta as exceções de app/erros.py
     │
     ▼
 repositories/  ← acesso à base de dados (consultas, commit, refresh)
     │
     ▼
 models/        ← tabelas SQLAlchemy (mapeamento para o esquema SQL)
```

| Camada | Pasta | Responsabilidade |
|---|---|---|
| Schemas | [`app/schemas/`](app/schemas) | Validação de entrada/saída com Pydantic v2 |
| Routers | [`app/routers/`](app/routers) | Rotas, códigos de estado, dependências de segurança |
| Services | [`app/services/`](app/services) | Regras de negócio e validações (ex.: eleição existe?) |
| Repositories | [`app/repositories/`](app/repositories) | Consultas SQLAlchemy (`select`, `add`, `commit`) |
| Models | [`app/models/`](app/models) | Tabelas, colunas e chaves |

Componentes transversais:

- [`app/database.py`](app/database.py) — ligação ao PostgreSQL (escrita e réplica de leitura) e sessão por pedido.
- [`app/cache.py`](app/cache.py) — Redis: tokens revogados, tentativas de login e fila de apuramento. Sem Redis, a API continua a funcionar (e deixa de o tentar até ele voltar).
- [`app/tarefas.py`](app/tarefas.py) — tarefas automáticas (no worker, ou em segundo plano na API).
- [`app/worker.py`](app/worker.py) — worker de apuramento (contentores `worker` e `worker-reserva`).
- [`app/erros.py`](app/erros.py) — exceções de negócio e a sua tradução para HTTP.
- [`app/security/`](app/security) — tokens JWT, selo dos votos e dependências de autorização (incluindo o `Auditor`).

---

## 4. Estrutura de ficheiros

```text
Backend/
├── app/
│   ├── models/          # tabelas SQLAlchemy (ut_*, ele_*, cand_*, ron_*, vot_*, res_*, aud_*, ...)
│   ├── schemas/         # validação Pydantic (entrada e resposta)
│   ├── repositories/    # acesso à base de dados
│   ├── services/        # regras de negócio (apuramento.py, auditoria.py, sondagem.py, ...)
│   ├── routers/         # rotas HTTP, agrupadas por prefixo
│   ├── security/        # tokens.py (JWT), integridade.py (selo dos votos), dependencias.py
│   ├── testes/          # testes pytest (conftest.py prepara um esquema isolado)
│   ├── cache.py         # Redis
│   ├── tarefas.py       # tarefas automáticas
│   ├── worker.py        # worker de apuramento (python -m app.worker)
│   ├── database.py      # engines, sessões e Base declarativa
│   └── erros.py         # erros de negócio -> respostas HTTP
├── basedados/
│   └── trustvote.sql    # criação da BD num só ficheiro: contas, replicação e tabelas
├── .env.example         # modelo do .env (o .env não vai para o git)
├── Dockerfile
├── main.py              # cria a app FastAPI, regista routers e arranca as tarefas
├── pytest.ini
├── requirements.txt
└── requirements-dev.txt # + pytest e httpx
```

---

## 5. Pré-requisitos

- **Python 3.12 ou superior** (o `Dockerfile` fixa 3.12).
- **Docker Desktop** iniciado, para a base de dados e o Redis.
- A infraestrutura de [`../Infraestrutura/`](../Infraestrutura) configurada (secção 6).

---

## 6. Configuração (`.env`)

A API lê a configuração de um ficheiro `.env` na pasta `Backend` (copia o
[`.env.example`](.env.example); o `.env` está no `.gitignore`):

| Variável | Por omissão | Uso |
|---|---|---|
| `DATABASE_HOST` | `localhost` | Anfitrião do PostgreSQL (aceita vários nós separados por vírgulas) |
| `DATABASE_PORT` | `5432` | Porta do PostgreSQL (a infraestrutura publica a `15432` em modo debug) |
| `DATABASE_NAME` | `trustvote` | Nome da base de dados |
| `DATABASE_USER` | `trustvote` | Utilizador da aplicação |
| `DATABASE_PASSWORD` | *(vazio)* | Password de `trustvote` (igual a `TRUSTVOTE_DB_PASSWORD` da infraestrutura) |
| `DATABASE_READ_HOST` | *(vazio)* | Réplica para as leituras públicas; sem ela, usa os nós de escrita |
| `JWT_SECRET` | **obrigatório** | Chave dos tokens (16+ caracteres). Sem ela a API não arranca |
| `JWT_MINUTOS_VALIDADE` | `60` | Validade dos tokens, em minutos |
| `VOTO_HMAC_SECRET` | derivado do `JWT_SECRET` | Segredo do selo dos votos. **Não mudar depois de haver votos** |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | *(desligado)* | Logout imediato e limite de tentativas de login (um Redis só) |
| `REDIS_SENTINELS`, `REDIS_GRUPO` | *(desligado)*, `trustvote` | Em vez de `REDIS_HOST`: lista `IP:porta` dos Sentinels, que indicam o Redis principal e seguem o failover (é o que o Docker usa) |
| `LOGIN_TENTATIVAS`, `LOGIN_JANELA_SEGUNDOS` | `5`, `900` | Falhas seguidas até bloquear o email, e por quanto tempo |
| `REGISTO_RESTRITO` | `false` | `true` = só a lista oficial de inscritos pode criar conta |
| `TAREFAS_INTERVALO` | `30` | Segundos entre ciclos das tarefas automáticas; `0` desliga (na API; o worker usa 30) |
| `APURAMENTO` | `imediato` | `worker` = encerrar uma volta só fecha a votação e pede o apuramento ao worker pela fila do Redis (é o que as instâncias usam no Docker) |
| `WORKER_NOME`, `WORKER_PAPEL` | `worker`, `principal` | Só no worker: nome nos logs e `reserva` para o que só apura sem o principal |
| `CORS_ORIGINS` | a entrada (8080) e os dois nginx (8081/8082), por `127.0.0.1` e `localhost` | Origens autorizadas a chamar a API |

---

## 7. Base de dados

O esquema **não é criado pelo Python**: vem de um único ficheiro,
[`basedados/trustvote.sql`](basedados/trustvote.sql), que o Docker corre ao criar a base de
dados. A criação automática de tabelas (`Base.metadata.create_all`) foi removida de
propósito — o SQL é a fonte única do esquema. O ficheiro tem três partes:

1. **Contas:** `trustvote` (usada pela API e dona das tabelas) e o utilizador de replicação,
   com as passwords do `.env`.
2. **Replicação:** autoriza a réplica a ligar-se a partir da rede Docker (`pg_hba.conf`).
3. **Tabelas:** as 13 tabelas, criadas já como `trustvote` (`SET ROLE`). Os testes usam só esta parte.

| Tabela | Conteúdo |
|---|---|
| `utilizador` | conta, `ut_num_estudante`, `ut_curso`, perfil e estado |
| `eleicao` | ato eleitoral, estado e `ele_quorum` |
| `ronda` | 1.ª/2.ª volta: `agendada` → `aberta` → `encerrada` → `apurada` |
| `candidato`, `ronda_candidato` | candidaturas (por `cand_orgao`) e quem concorre em cada volta |
| `habilitacao` | caderno eleitoral |
| `participacao` | **quem** votou (com data) |
| `voto` | **em quem** se votou (sem utilizador nem data); `vot_cand_id` a `NULL` = branco; `vot_hash` = SHA-256 do recibo; `vot_integridade` = selo HMAC |
| `resultado` | apuramento de cada volta (a linha com `res_cand_id` a `NULL` são os brancos) |
| `auditoria` | registo de ações, com `aud_hash_anterior`/`aud_hash_atual` encadeados |
| `sondagem_participacao`, `sondagem_resposta` | quem respondeu à sondagem / o que respondeu, sem ligação entre si |
| `estudante_inscrito` | lista oficial de números de estudante |

**Importante:** o PostgreSQL só executa este ficheiro **na primeira inicialização**, quando
o volume de dados está vazio. Para recriar a base de dados do zero (apaga os dados):
`.\stack.cmd down`, apagar os volumes `trustvote_pg-primary-data` e `trustvote_pg-replica-data`,
e `.\stack.cmd up`. Uma alteração ao esquema numa base já criada faz-se com `ALTER TABLE` à mão,
e tem de ser acrescentada também a este ficheiro.

### Testes

```powershell
cd Backend
..\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
..\.venv\Scripts\python.exe -m pytest
```

Usam a BD do `.env` (com a stack arrancada com `.\stack.cmd up -Dev`), mas num esquema próprio
(`teste_pytest`) criado e apagado pelos testes; sem BD, são saltados.

---

## 8. Executar localmente (Windows)

O ambiente virtual do projeto vive na **raiz de `05_Artefactos`**, na pasta `.venv`.
A API é executada a partir da pasta `Backend`.

```powershell
cd "C:\Users\<utilizador>\...\05_Artefactos\Backend"
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Se preferires ativar o ambiente virtual:

```powershell
..\.venv\Scripts\Activate.ps1
python -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Se ainda não existir ambiente virtual, cria-o na raiz de `05_Artefactos`:

```powershell
cd "C:\Users\<utilizador>\...\05_Artefactos"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r Backend\requirements.txt
```

Mantém o terminal aberto enquanto usas a API:

- Documentação interativa: <http://localhost:8001/docs>

`0.0.0.0` é o endereço de escuta do servidor; no navegador usa `localhost`.
Usa `--reload` durante o desenvolvimento — sem ele, o servidor continua a servir
o código antigo que tem em memória depois de editares um ficheiro.

---

## 9. Endpoints

### Públicos

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Estado da instância (`{"status":"ok","instance":...}`) — healthcheck da infraestrutura |
| `GET` | `/docs`, `/openapi.json` | Documentação interativa e esquema OpenAPI |
| `POST` | `/auth/register` | Cria uma conta (exige **nº de estudante**) → `201` · `409` se o nome/email/nº já existem · `403` se o registo está restrito e o nº não está na lista · `422` se os dados são inválidos |
| `POST` | `/auth/login` | Devolve um token de acesso → `200` · `401` se as credenciais estão erradas · `429` depois de 5 falhas seguidas |
| `GET` | `/publico/resumo` | Eleição em destaque, participação e candidaturas (sem votos por candidato) — lido na réplica |
| `GET` | `/publico/historico` | Eleições encerradas, com datas, participação e hora do apuramento — lido na réplica |
| `GET` | `/publico/configuracao` | Regras reais da plataforma: duração da sessão, limite de tentativas de login e modo de apuramento |

`POST /auth/register`:

```json
{ "nome_utilizador": "ana_silva", "email": "ana@exemplo.pt", "num_estudante": "20241234", "curso": "Engenharia Informática", "password": "Password123" }
```

`POST /auth/login` com `{"email": "ana@exemplo.pt", "password": "Password123"}` → `{"access_token": "<jwt>", "token_type": "bearer", "expires_in": 3600}`

Nas rotas protegidas envia-se `Authorization: Bearer <jwt>`.

### Para utilizadores autenticados

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/auth/eu` | Dados da conta |
| `POST` | `/auth/logout` | Termina a sessão: o token deixa de ser aceite (`204`) |
| `POST` | `/auth/password` | Muda a palavra-passe: `{"atual": "...", "nova": "..."}` |
| `GET` | `/eleicoes?estado=` | Eleições visíveis: o eleitor só vê as publicadas em que está habilitado |
| `GET` | `/eleicoes/{id}` | Eleição com candidatos e rondas |
| `POST` | `/eleicoes/{id}/rondas/{numero}/votos` | `{"candidato_id": 3}` ou `{"branco": true}` → recibo · `409` se já votou |
| `GET` | `/eleicoes/{id}/participacao` | Diz se já votou na volta atual |
| `GET` | `/eleicoes/{id}/resultados` | Votos por candidato, brancos, inválidos, participação e quórum · `409` para o eleitor antes de a volta encerrar |
| `GET` | `/recibos/{codigo}/verificar` | Confirma que o voto foi contado (e que o selo está intacto), sem revelar a escolha |
| `GET` | `/eleicoes/{id}/sondagem` | Projeção da sondagem e se o utilizador já respondeu |
| `POST` | `/eleicoes/{id}/sondagem/respostas` | `{"candidato_id": 3}` · uma resposta por eleitor (`409` à segunda) |

O recibo não fica guardado no servidor nem ligado ao eleitor, por isso não existe
`GET /recibos`: o frontend guarda a cópia no dispositivo.

### Só para administradores

Estas rotas exigem token de um utilizador com `ut_perfil = 'administrador'`:
sem token → `401`; com perfil `eleitor` → `403`.

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/eleicoes` | Cria uma eleição (nasce em `rascunho`) |
| `PATCH`, `DELETE` | `/eleicoes/{id}` | Altera antes de a votação começar · apaga em `rascunho` |
| `POST` | `/eleicoes/{id}/agendar`, `/iniciar`, `/encerrar` | Muda o estado da eleição |
| `POST`, `PATCH` | `/eleicoes/{id}/rondas`, `/rondas/{numero}` | Cria a volta seguinte · altera as datas |
| `POST` | `/eleicoes/{id}/rondas/{numero}/abrir`, `/encerrar` | Abre ou encerra uma volta |
| `POST`, `PATCH`, `DELETE` | `/eleicoes/{id}/candidatos`, `/candidatos/{cid}` | Gere os candidatos |
| `GET`, `POST`, `DELETE` | `/eleicoes/{id}/habilitados`, `/habilitados/{uid}` | Gere o caderno eleitoral |
| `GET` | `/eleicoes/{id}/estatisticas` | Participação e votos por hora |
| `GET` | `/eleicoes/{id}/integridade` | Selos dos votos e urna contra participações, por volta |
| `GET`, `PATCH` | `/utilizadores`, `/utilizadores/{id}` | Lista, suspende ou muda o perfil |
| `POST` | `/utilizadores/{id}/repor-password` | Gera uma palavra-passe temporária |
| `GET` | `/auditoria?limite=200` | Registos de auditoria, mais recentes primeiro |
| `GET` | `/auditoria/verificar` | Recalcula a cadeia de hashes e indica o primeiro registo adulterado |
| `GET`, `POST`, `DELETE` | `/estudantes-inscritos`, `/estudantes-inscritos/{num}` | Lista oficial de inscritos (`{"estudantes": [{"num_estudante": "20260001", "nome": "...", "curso": "..."}]}`) |

Candidatos, voltas e caderno eleitoral geridos só dentro de `/eleicoes/{id}`, onde as
regras de estado e a auditoria se aplicam (as rotas soltas `/candidatos`, `/rondas`,
`/rondas-candidatos` e `/habilitacoes` foram retiradas).

### Códigos de erro

| Código | Quando |
|---|---|
| `400` | Violação de uma regra de negócio (ex.: `data_fim` não é posterior a `data_inicio`) |
| `401` | Falta o token, ou é inválido/expirado/terminado |
| `403` | Autenticado, mas sem permissão (perfil não é administrador) |
| `404` | O recurso indicado não existe |
| `409` | Registo duplicado ou estado incompatível (ex.: já votou, volta já encerrada) |
| `422` | Dados inválidos à entrada (validação do Pydantic) |
| `429` | Demasiadas tentativas de login falhadas |
| `503` | Base de dados indisponível (ex.: durante um failover) |

---

## 10. Segurança

- Passwords guardadas em **Argon2** (`pwdlib[argon2]`); nunca são devolvidas pela API.
- Tokens **JWT HS256** com `sub`, `nome_utilizador`, `perfil`, `iat`, `exp` e `jti`; o logout
  guarda o `jti` no Redis até o token expirar.
- `JWT_SECRET` é obrigatório: sem ele a API recusa arrancar.
- A verificação de credenciais devolve sempre a **mesma mensagem**, para não revelar
  se um email existe; 5 falhas seguidas bloqueiam o email durante 15 minutos.
- O token é validado em cada pedido; um utilizador inativo perde o acesso (`401`).
- **Anonimato:** `participacao` (quem) e `voto` (em quem) não têm ligação; o voto não tem data
  e o id é um UUID aleatório; a auditoria nunca regista votos; o recibo só existe no dispositivo
  do eleitor (o servidor guarda o hash). Ao apurar, os votos são regravados por ordem
  aleatória, para a ordem de chegada não ficar na tabela (ver Próximos passos).
- **Administradores:** entram só com e-mail e palavra-passe (não há dois fatores); o limite
  de tentativas de login protege contra palavras-passe adivinhadas.
- **Integridade:** selo HMAC em cada voto; o apuramento só conta votos com selo válido.
  Encerrar uma volta bloqueia-a e espera pelos votos em curso, para nenhum ficar de fora.
- **Auditoria:** cadeia de hashes com `pg_advisory_xact_lock`, para as duas instâncias
  escreverem pela ordem certa.

---

## 11. Executar com Docker

```powershell
cd "C:\...\05_Artefactos\Backend"
docker build -t trustvote-backend .
docker run --rm --name trustvote-api -p 8001:8001 trustvote-backend
```

Se a porta `8001` já estiver ocupada, publica noutra, por exemplo `-p 8002:8001`,
e abre <http://localhost:8002/>.

> A imagem inclui a pasta `app/` (importada pelo `main.py`) e a porta é
> configurável por `APP_PORT` (por omissão `8001`), para poder entrar no Compose
> da infraestrutura sem alterações ao código.

Para a stack completa (dois servidores com nginx, API e worker, PostgreSQL com
réplica, Redis e monitor), usa o `stack.cmd` de
[`../Infraestrutura`](../Infraestrutura/README.md). A mesma imagem corre a API, os workers
(`python -m app.worker`) e o monitor.

---

## 12. Resolução de problemas

- **`ModuleNotFoundError: No module named 'app'`:** estás a executar a partir da pasta
  errada. Corre o Uvicorn a partir de `Backend` (`python -m uvicorn main:app ...`).
- **`can't open file ...\Backend\main.py`:** usa `python -m uvicorn main:app ...`,
  não `python app\main.py` nem `python main.py`.
- **`ERR_CONNECTION_REFUSED`:** confirma que o Uvicorn (ou o container) continua em
  execução e abre a porta publicada, `localhost:8001`.
- **Porta em uso:** escolhe outra porta local (ex.: `8002`); com Docker usa `-p 8002:8001`.
- **Mudanças não aparecem:** o servidor não está com `--reload`; para-o e arranca de novo.
- **Erros de ligação à base de dados:** confirma que os contentores estão `healthy`
  (`docker compose ps`) e que o `.env` aponta ao host e porta corretos.
- **Não consigo fazer login:** o login exige `ut_ativo = TRUE` e `ut_perfil` válido.
  Para testar operações de administrador, promove a conta
  (`UPDATE utilizador SET ut_perfil='administrador' WHERE ut_nome='...'`).

---

## 13. Próximos passos

1. **Anonimato com a volta aberta:** o voto e a participação são gravados na mesma
   transação (para nenhum ficar sem o outro), por isso partilham o `xmin` até a volta ser
   apurada; o apuramento regrava os votos por ordem aleatória e desfaz essa ligação. Quem
   tiver acesso à BD (ou ao WAL e aos backups) durante a votação ainda pode cruzá-los.
   Eliminar isto exige outro desenho (ex.: assinaturas cegas ou mistura de votos).
2. Autenticação de dois fatores para os administradores (foi retirada para simplificar a demonstração).

Antes de usar o sistema numa votação real, é necessário definir o modelo de ameaça e
rever especificamente as garantias de anonimato do voto.
