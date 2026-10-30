# Backend do TrustVote

API REST do TrustVote, construída com **FastAPI**, **SQLAlchemy** e **PostgreSQL**.
Serve as votações da **Associação de Estudantes de uma universidade europeia** e as
instâncias de aplicação definidas na infraestrutura Docker
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
| Gestão de eleições | CRUD de `eleicao`, `candidato` (por **órgão social**), `ronda`, `ronda_candidato` e `habilitacao` |
| Autorização | Dependências `utilizador_atual` (401) e `exigir_administrador` (403) |
| Base de dados | Ligação ao PostgreSQL via SQLAlchemy; esquema aplicado pelos scripts SQL canónicos |
| Erros | Exceções de negócio traduzidas automaticamente em `404` / `409` / `400` |
| Healthcheck | `GET /health` — usado pelo healthcheck do Compose e pelo balanceador |

### Ainda não implementado

- **Voto** (`participacao`, `voto`) e **apuramento de resultados** (`resultado`) — RF06/RF07/RF09/RF10.
- **Auditoria** (`auditoria`) — RF11.
- **TOTP** (`app/security/totp.py` está vazio) e as rotas `reset-password`/`verify-password` (stubs).
- **Worker** de tarefas assíncronas (a pasta ainda não existe).
- Leitura a partir da réplica (`DATABASE_READ_HOST`) e uso do Redis.

> As pastas em `app/` existem, mas a sua presença não significa que todas as
> funcionalidades estejam prontas. O que está confirmado está na tabela acima.

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

- [`app/database.py`](app/database.py) — ligação ao PostgreSQL e sessão por pedido.
- [`app/erros.py`](app/erros.py) — exceções de negócio e a sua tradução para HTTP.
- [`app/security/`](app/security) — tokens JWT e dependências de autorização.

---

## 4. Estrutura de ficheiros

```text
Backend/
├── app/
│   ├── models/          # tabelas SQLAlchemy (ut_*, ele_*, cand_*, ron_*, rc_*, hab_*)
│   ├── schemas/         # validação Pydantic (entrada e resposta)
│   ├── repositories/    # acesso à base de dados
│   ├── services/        # regras de negócio
│   ├── routers/         # rotas HTTP, agrupadas por prefixo
│   ├── security/        # tokens.py (JWT), dependencias.py, totp.py (por implementar)
│   ├── testes/          # espaço para testes (teste_top.py ainda vazio)
│   ├── database.py      # engine, sessão e Base declarativa
│   └── erros.py         # erros de negócio -> respostas HTTP
├── config/
│   └── database/init/docker_sql_and_sh/
│       ├── 00-trustvote-user.sql   # cria o utilizador trustvote e torna-o dono da BD
│       └── trustvote.sql           # tabelas, executadas como trustvote (SET ROLE)
├── .env                 # configuração local (ver aviso na secção 5)
├── Dockerfile
├── main.py              # cria a app FastAPI e regista routers e tratadores
└── requirements.txt
```

---

## 5. Pré-requisitos

- **Python 3.12 ou superior** (o `Dockerfile` fixa 3.12).
- **Docker Desktop** iniciado, para a base de dados e o Redis.
- A infraestrutura de [`../Infraestrutura/`](../Infraestrutura) configurada (secção 6).

---

## 6. Configuração (`.env`)

O `app/database.py` lê a configuração de um ficheiro `.env` na pasta `Backend`:

| Variável | Por omissão | Uso |
|---|---|---|
| `DATABASE_HOST` | `localhost` | Anfitrião do PostgreSQL |
| `DATABASE_PORT` | `5432` | Porta do PostgreSQL (a infraestrutura publica a `15432` em modo debug) |
| `DATABASE_NAME` | `trustvote` | Nome da base de dados |
| `DATABASE_USER` | `trustvote` | Utilizador da aplicação |
| `DATABASE_PASSWORD` | *(vazio)* | Password de `trustvote` (igual a `TRUSTVOTE_DB_PASSWORD` da infraestrutura) |
| `JWT_SECRET` | valor de desenvolvimento | Chave de assinatura dos tokens — **definir em qualquer ambiente a sério** |
| `JWT_MINUTOS_VALIDADE` | `60` | Validade dos tokens, em minutos |

Exemplo de `.env` para desenvolvimento local:

```dotenv
DATABASE_HOST=127.0.0.1
DATABASE_PORT=15432
DATABASE_NAME=trustvote
DATABASE_USER=trustvote
DATABASE_PASSWORD=<a mesma de TRUSTVOTE_DB_PASSWORD>
JWT_SECRET=<uma string longa e aleatória>
```

> **Aviso de segurança:** o `Backend/.env` está atualmente versionado no git, o que
> expõe a password da base de dados no histórico. Devia ser retirado do controlo de
> versões (com um `.gitignore` e um `.env.example` com valores fictícios). Sem
> `JWT_SECRET` definido, é usado um segredo de desenvolvimento conhecido, que
> permite forjar tokens — **não usar assim em produção.**

---

## 7. Base de dados

O esquema **não é criado pelo Python**: as tabelas vêm dos scripts SQL canónicos
em [`config/database/init/docker_sql_and_sh/`](config/database/init/docker_sql_and_sh),
que o PostgreSQL monta no volume de inicialização. A criação automática de tabelas
(`Base.metadata.create_all`) foi removida de propósito — o SQL é a fonte única do esquema.

- `00-trustvote-user.sql` — cria o utilizador `trustvote` e torna-o dono da base de dados.
- `trustvote.sql` — as 10 tabelas, executadas como `trustvote` (`SET ROLE`).

| Tabela | Mapeada no Python? |
|---|---|
| `utilizador` | sim (com `ut_num_estudante` e `ut_curso`) |
| `eleicao` | sim |
| `ronda` | sim |
| `candidato` | sim (por `cand_orgao`: `direcao` / `assembleia` / `conselho_fiscal`) |
| `ronda_candidato` | sim |
| `habilitacao` | sim |
| `participacao` | não (voto por implementar) |
| `voto` | não (voto por implementar) |
| `resultado` | não (apuramento por implementar) |
| `auditoria` | não (RF11 por implementar) |

**Importante:** o PostgreSQL só executa estes scripts **na primeira inicialização**,
quando o volume de dados está vazio. Se alterares o esquema depois de já existirem
dados, aplica a alteração por migração (`ALTER TABLE ...`) em vez de apagar o volume.

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

- API: <http://localhost:8001/>
- Documentação interativa: <http://localhost:8001/docs>

`0.0.0.0` é o endereço de escuta do servidor; no navegador usa `localhost`.
Usa `--reload` durante o desenvolvimento — sem ele, o servidor continua a servir
o código antigo que tem em memória depois de editares um ficheiro.

---

## 9. Endpoints

### Públicos

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/` | Estado da API |
| `GET` | `/health` | Estado da instância (`{"status":"ok","instance":...}`) — healthcheck da infraestrutura |
| `GET` | `/docs`, `/openapi.json` | Documentação interativa e esquema OpenAPI |
| `GET` | `/auth/` | Mensagem de boas-vindas |
| `POST` | `/auth/register` | Cria uma conta (exige **nº de estudante**) → `201` · `409` se o nome/email/nº já existem · `422` se os dados são inválidos |
| `POST` | `/auth/login` | Devolve um token de acesso → `200` · `401` se as credenciais estão erradas |
| `POST` | `/auth/logout` | *Stub* |
| `POST` | `/auth/reset-password` | *Stub* |
| `POST` | `/auth/verify-password` | *Stub* |
| `GET` | `/pedidos/lista` | *Stub* |

`POST /auth/register`:

```json
{ "nome_utilizador": "ana_silva", "email": "ana@exemplo.pt", "num_estudante": "20241234", "curso": "Engenharia Informática", "password": "Password123" }
```

`POST /auth/login` → `{"access_token": "<jwt>", "token_type": "bearer"}`

Nas rotas protegidas envia-se `Authorization: Bearer <jwt>`.

### Só para administradores

Estas rotas exigem token de um utilizador com `ut_perfil = 'administrador'`:
sem token → `401`; com perfil `eleitor` → `403`.

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/eleicoes` | Cria uma eleição (nasce em `rascunho`) |
| `GET` | `/eleicoes` | Lista as eleições |
| `GET` | `/eleicoes/{eleicao_id}` | Obtém uma eleição |
| `POST` | `/candidatos` | Cria uma candidatura a um órgão (`direcao` / `assembleia` / `conselho_fiscal`) |
| `GET` | `/candidatos?eleicao_id=` | Lista candidatos (filtro opcional) |
| `GET` | `/candidatos/{candidato_id}` | Obtém um candidato |
| `POST` | `/rondas` | Cria uma ronda (1.ª ou 2.ª volta) |
| `GET` | `/rondas?eleicao_id=` | Lista rondas (filtro opcional) |
| `GET` | `/rondas/{ronda_id}` | Obtém uma ronda |
| `POST` | `/rondas-candidatos` | Põe um candidato a concorrer numa ronda |
| `GET` | `/rondas-candidatos?ronda_id=` | Lista inscrições (filtro opcional) |
| `POST` | `/habilitacoes` | Habilita um utilizador a votar numa eleição (o registo já o faz automaticamente nas eleições abertas) |
| `GET` | `/habilitacoes?eleicao_id=` | Lista habilitações (filtro opcional) |

### Códigos de erro

| Código | Quando |
|---|---|
| `400` | Violação de uma regra de negócio (ex.: `data_fim` não é posterior a `data_inicio`) |
| `401` | Falta o token, ou é inválido/expirado |
| `403` | Autenticado, mas sem permissão (perfil não é administrador) |
| `404` | O recurso indicado não existe |
| `409` | Registo duplicado (ex.: volta repetida, candidato já inscrito) |
| `422` | Dados inválidos à entrada (validação do Pydantic) |

---

## 10. Segurança

- Passwords guardadas em **Argon2** (`pwdlib[argon2]`); nunca são devolvidas pela API.
- Tokens **JWT HS256** com as claims `sub`, `nome_utilizador`, `perfil` e `exp`.
- A verificação de credenciais devolve sempre a **mesma mensagem**, para não revelar
  se um nome de utilizador existe.
- O token é validado em cada pedido; um utilizador inativo perde o acesso (`401`).

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

Para a stack completa (nginx, duas instâncias, PostgreSQL e Redis), usa o
[`../Infraestrutura/compose.yaml`](../Infraestrutura/compose.yaml) — ver o
[README da Infraestrutura](../Infraestrutura/README.md).

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

1. Fluxo de **voto** (`participacao` + `voto`) com transação atómica e anonimato.
2. **Auditoria** (RF11) e **apuramento de resultados** (RF09/RF10).
3. Ligar o backend ao Compose da infraestrutura (ver o [README da Infraestrutura](../Infraestrutura/README.md), secção 9).
4. Retirar o `.env` do git e acrescentar `.gitignore` + `.env.example`.
5. Testes automatizados com `pytest` (a pasta `app/testes/` está por preencher).

Antes de usar o sistema numa votação real, é necessário completar estas funcionalidades,
definir o modelo de ameaça e rever especificamente as garantias de anonimato do voto.
