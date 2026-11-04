# TrustVote

Sistema de votação eletrónica para a **Associação de Estudantes de uma universidade
europeia** — **API FastAPI + PostgreSQL + Redis**, a correr em Docker num único PC
Windows.

Este README é o **ponto de entrada**: explica o que existe no repositório, como
pôr tudo a funcionar do zero e onde está a documentação detalhada. Quem pega no
código pela primeira vez deve começar por aqui.

---

## 1. O que existe neste repositório

```text
05_Artefactos/
├── Backend/            # API (FastAPI + SQLAlchemy + PostgreSQL)
├── Frontend/           # páginas HTML/CSS/JS, servidas pelo Live Server
├── Infraestrutura/     # Docker Compose: nginx, aplicações, PostgreSQL e Redis
├── README.md           # este ficheiro — visão geral e como começar
├── ApresentaçãoTrustVote_1aEntrega.pdf
└── Relatório_TrustVote_1aEntrega (1).pdf
```

| Pasta | O que é | Documentação detalhada |
|---|---|---|
| [`Backend/`](Backend/README.md) | API REST: autenticação (JWT), atos eleitorais, órgãos sociais, candidaturas, rondas e habilitações | [Backend/README.md](Backend/README.md) |
| [`Infraestrutura/`](Infraestrutura/README.md) | `compose.yaml` com nginx (balanceador), 2 instâncias, PostgreSQL primário + réplica e Redis | [Infraestrutura/README.md](Infraestrutura/README.md) |

Cada pasta tem o seu próprio README, com todos os detalhes. Este documento só
dá o essencial para arrancar.

---

## 2. Arquitetura em duas linhas

```text
   browser (Live Server, 127.0.0.1:5500)
      │
      ▼
   nginx :8080 ──► servidor1 ─┐
   (balanceador) ► servidor2 ─┤
                              ├──► db-primary ──(síncrona)──► db-replica
                              └──► redis            ▲              ▲
                                                    └── monitor ───┘
```

Se a BD primária falhar, o monitor promove a réplica e a API passa a usá-la sem reiniciar. O
guião da demonstração está em [Infraestrutura/demo/GUIAO.md](Infraestrutura/demo/GUIAO.md).

- **`Infraestrutura/`** sobe toda esta stack com Docker, num único PC.
- **`Backend/`** é a aplicação; em desenvolvimento corre fora do Docker, na porta
  **`8001`**, ligada ao PostgreSQL da infraestrutura.

- O **frontend** tem um único endereço: abre `Frontend/pages/inicio.html` com o **Live Server**
  na raiz do projeto, em <http://127.0.0.1:5500/Frontend/pages/inicio.html>.
- O frontend chama sempre a API em `http://127.0.0.1:8080/api` (definida em
  `Frontend/js/models/servidor.js`). O backend aceita como origens **tanto
  `http://127.0.0.1:5500` como `http://localhost:5500`** (a variável `CORS_ORIGINS`,
  com esses dois valores por omissão). Isto é necessário porque, para o navegador,
  `localhost` e `127.0.0.1` são origens **diferentes**: abrir a página por um nome e
  apontar a API para o outro dá erro de CORS e a mensagem "Não foi possível contactar
  o servidor".
- O **nginx** encaminha `/api/` para `servidor1`/`servidor2`, que correm a imagem do
  `Backend/`. Quem abrir `http://127.0.0.1:8080/` é reencaminhado para o Live Server.
- O frontend não tem dados próprios: tudo o que mostra vem da API.

---

## 3. Pré-requisitos

- **Docker Desktop** iniciado (Windows 10/11 com WSL 2). Confirma com `docker info`.
- **Python 3.12 ou superior** (só é necessário no modo B).
- Portas livres:
  - `8080` — nginx, o único ponto de entrada publicado (sempre);
  - `8001` — API local (só no modo B);
  - `15432` / `15433` / `5050` — base de dados e pgAdmin (só com o `compose.debug.yaml`).

---

## 4. Comandos para pôr tudo a correr

Há **dois modos**, ambos sobre a mesma base de dados e o mesmo frontend:

| Modo | Onde corre a API | Para que serve |
|---|---|---|
| **A. Tudo em Docker** (recomendado) | contentores `servidor1` / `servidor2` | demonstração completa: balanceamento, replicação e failover |
| **B. API local + infraestrutura em Docker** | no teu PC, porta `8001` | desenvolvimento, com `--reload` a cada gravação |

### Passo 0 — Uma só vez: ambiente virtual (só é preciso no modo B)

O ambiente virtual vive na raiz de `05_Artefactos`, em `.venv`.

```powershell
cd "C:\...\05_Artefactos"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r Backend\requirements.txt
```

### Passo 1 — Criar o `.env` da infraestrutura (só na primeira vez)

```powershell
cd "C:\...\05_Artefactos\Infraestrutura"
copy .env.example .env
# Abre o .env e substitui TODOS os valores "mudar_*" por passwords próprias.
```

### Passo 2 — Subir a infraestrutura

```powershell
# Modo A — tudo em Docker (nginx + servidor1 + servidor2 + BD + réplica + redis)
docker compose up -d --build --wait

# Modo B — igual, mas com a BD publicada em 127.0.0.1:15432 (para a API local)
docker compose -f compose.yaml -f compose.debug.yaml up -d --build --wait

docker compose ps
```

- `--wait` só devolve quando todos os contentores estão `healthy`.
- `--build` reconstrói a imagem do backend. **Sem ele, o Compose reutiliza a imagem
  que já existe** e as alterações ao `Dockerfile` ou ao `requirements.txt` não têm
  efeito nenhum — foi o que já provocou erros `502` difíceis de explicar.
- O `compose.debug.yaml` é obrigatório no **modo B**: é ele que **publica a base de
  dados em `127.0.0.1:15432`**. Também acrescenta o pgAdmin em
  <http://127.0.0.1:5050>.

### Passo 3 — (Modo B) Configurar e arrancar a API no PC

O `Backend/.env` aponta para a base de dados publicada no passo anterior:

```dotenv
DATABASE_HOST=127.0.0.1
DATABASE_PORT=15432
DATABASE_NAME=trustvote
DATABASE_USER=trustvote
DATABASE_PASSWORD=<o mesmo valor de TRUSTVOTE_DB_PASSWORD do .env da Infraestrutura>
```

```powershell
cd "C:\...\05_Artefactos\Backend"
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Corre sempre a partir da pasta `Backend`, senão dá
`ModuleNotFoundError: No module named 'app'`. Usa `--reload` durante o
desenvolvimento: sem ele, o servidor continua a servir o código que tem em memória.

### Passo 4 — Abrir o frontend

Abre `Frontend/pages/inicio.html` com o **Live Server** (botão direito → *Open with
Live Server*) → <http://127.0.0.1:5500/Frontend/pages/inicio.html>.

O frontend chama **sempre** a API pelo nginx, em `http://127.0.0.1:8080/api`.

### Passo 5 — Confirmar que funciona

| | Endereço |
|---|---|
| API através do nginx | <http://127.0.0.1:8080/api/health> |
| Documentação interativa | <http://127.0.0.1:8080/docs> |
| API local (só no modo B) | <http://localhost:8001/docs> |
| Aplicação | <http://127.0.0.1:5500/Frontend/pages/inicio.html> |
| pgAdmin (com o ficheiro de debug) | <http://127.0.0.1:5050> |

O registo exige o **número de estudante** (identificador do eleitor) e a conta é
automaticamente habilitada a votar nas eleições ainda não encerradas. Para testar as
rotas de administração, cria uma conta e promove-a:

```powershell
docker exec trustvote-db-primary psql -U trustvote -d trustvote -c "UPDATE utilizador SET ut_perfil='administrador' WHERE ut_nome='<o teu nome>';"
```

### Passo 6 — Parar

Desce sempre com o **mesmo conjunto de ficheiros** que usaste para subir:

```powershell
cd "C:\...\05_Artefactos\Infraestrutura"

docker compose down                      # modo A (mantém os dados)
docker compose down --remove-orphans     # idem, e remove contentores órfãos

# modo B — tem de incluir o ficheiro de debug, senão o pgadmin sobrevive
docker compose -f compose.yaml -f compose.debug.yaml down --remove-orphans

docker compose down -v                   # ATENÇÃO: apaga também os dados (volumes)
```

> Se usares `docker compose down` sozinho depois de teres subido com o
> `compose.debug.yaml`, o contentor `pgadmin` não é removido e volta a bloquear a
> rede no `down` seguinte, com `Resource is still in use`. Inclui sempre
> `--remove-orphans`.

---

## 5. Comandos do dia a dia

```powershell
cd "C:\...\05_Artefactos\Infraestrutura"

docker compose ps                      # estado + health dos contentores
docker compose logs -f nginx           # seguir os logs de um serviço
docker compose restart servidor1       # reiniciar só uma instância

docker compose up -d --wait            # aplicar alterações ao compose.yaml
docker compose up -d --build --wait    # aplicar alterações ao Dockerfile / requirements.txt
```

Ligação à base de dados a partir do terminal:

```powershell
docker exec -it trustvote-db-primary psql -U trustvote -d trustvote -c "\dt"
```

Libertar a porta `8001`, quando a API local não arranca com `Errno 10048`:

```powershell
Get-NetTCPConnection -LocalPort 8001 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

Remover a rede Docker, se o `down` se queixar de `Resource is still in use`:

```powershell
docker network rm trustvote-network
```

---

## 6. Estrutura do código do backend

O backend segue sempre as mesmas camadas — um pedido HTTP atravessa-as nesta ordem:

```text
routers/  →  services/  →  repositories/  →  models/
 (HTTP)      (regras)       (base de dados)    (tabelas)
```

- `app/schemas/` — validação de entrada/saída (Pydantic).
- `app/security/` — tokens JWT e dependências de autorização.
- `app/erros.py` — erros de negócio traduzidos em `400`/`404`/`409`.
- `config/database/init/` — scripts SQL canónicos do esquema (a BD é a fonte da verdade).

Detalhes em [Backend/README.md](Backend/README.md).

---

## 7. O que ainda falta

Estado atual, em resumo:

**Backend** — feito: registo (com nº de estudante), login com JWT, gestão de
eleições, candidaturas, rondas e caderno eleitoral, **voto anónimo com recibo**,
verificação de recibo, contagem de resultados, estatísticas e resumo público.

Falta expor, no backend, as rotas que o frontend já invoca:

| Rota em falta | Área |
|---|---|
| `POST /auth/totp/configurar`, `/ativar`, `/desativar` | TOTP (a lógica ainda não existe em `app/security/totp.py`) |
| `GET /auditoria` | auditoria (RF11) |
| `GET /eleicoes/{id}/sondagem`, `POST /eleicoes/{id}/sondagem/respostas` | sondagem |
| `GET /recibos` | listagem de recibos — **não deve existir** por desenho: o servidor só guarda o hash do recibo; a cópia vive no `localStorage` do browser |

Falta ainda: gravação do **apuramento** na tabela `resultado` (hoje é contado a cada
pedido), **fecho automático** das rondas por `data_fim` (hoje é manual), **worker**
assíncrono, leitura a partir da réplica (`DATABASE_READ_HOST`) e uso real do Redis.

**Frontend** — ligado à API. As áreas que dependem das rotas acima mostram que a
funcionalidade ainda não está disponível.

> Nota: no `Frontend/js/models/api.js` as chamadas de voto, participação,
> resultados, estatísticas e verificação de recibo estão marcadas com a opção `pend`.
> Isso é resíduo: essas rotas **já existem** no backend. Só o efeito secundário fica
> estranho — um `404` real (ex.: eleição inexistente) é apresentado como
> "funcionalidade ainda não disponível".

**Infraestrutura** — feito: stack completa a funcionar com a API real (balanceamento,
replicação síncrona, failover automático da BD, backups), com o frontend no Live Server.
Limitações em [Infraestrutura > Limitações conhecidas](Infraestrutura/README.md).

Listas completas em [Backend > Próximos passos](Backend/README.md) e
[Infraestrutura > Integração](Infraestrutura/README.md).

---

## 8. Problemas comuns

| Sintoma | Causa provável / solução |
|---|---|
| `ModuleNotFoundError: No module named 'app'` | Estás a correr o Uvicorn fora da pasta `Backend`. Corre `python -m uvicorn main:app ...` a partir de `Backend`. |
| `ERR_CONNECTION_REFUSED` em `localhost:8001` | O Uvicorn não está a correr, ou a porta é outra. Ver Passo 3. |
| `[Errno 10048]` a ligar à porta `8001` | Já há um Uvicorn a segurar a porta (normalmente um processo órfão do `--reload`). Liberta-a com o comando da [secção 5](#5-comandos-do-dia-a-dia). |
| O backend não liga à base de dados | Falta o `compose.debug.yaml` (a BD não está publicada em `15432`) ou as credenciais do `Backend/.env` não coincidem com o `.env` da Infraestrutura. |
| Alterações ao código não aparecem | Sem `--reload` (API local) ou sem `--build` (contentores). Ver [secção 5](#5-comandos-do-dia-a-dia). |
| `502` no nginx, com `no live upstreams` nos logs | As instâncias `servidor1`/`servidor2` estão em baixo, **ou** a imagem do backend está desatualizada (foi construída com outra porta). Sobe com `docker compose up -d --build --wait`. |
| "Não foi possível contactar o servidor" no browser | CORS: a página está em `localhost:5500` mas o `CORS_ORIGINS` do backend só conhece `127.0.0.1:5500` (ou o contrário). Usa o mesmo nome nos dois lados. |
| `503` / "Serviço temporariamente indisponível" | A API está viva mas sem acesso à base de dados. Confirma `docker compose ps` e `GET /health`. |
| `Resource is still in use` no `docker network rm` | Ficou um contentor órfão (tipicamente o `pgadmin`, ao descer sem o `compose.debug.yaml`). Usa `down --remove-orphans`. |
| `docker compose up` recusa arrancar | Falta uma password no `.env` da Infraestrutura. Copia o `.env.example` e preenche os `mudar_*`. |
| `port is already allocated` | A porta está ocupada (ex.: outro PostgreSQL na `5432`). Fecha o processo ou muda a porta no `.env`. |
| Tabelas novas não aparecem na BD | Os scripts SQL só correm com o volume vazio. Ver [Infraestrutura > Scripts de inicialização](Infraestrutura/README.md). |
| `docker compose` não responde | O Docker Desktop está desligado. Confirma com `docker info`. |

---

## 9. Convenções

- **Língua:** código, comentários e documentação em português (Portugal).
- **Segredos:** o `.gitignore` da raiz cobre `.env`, `Backend/.env` e
  `Infraestrutura/.env`, e de facto **nenhum está versionado**. Ainda assim, o
  `Backend/.env` **já esteve** — a password da base de dados continua no **histórico**
  do git. Só sai de lá rodando a password (mais simples) ou reescrevendo o histórico.
- **Metadados de IDE:** o `.gitignore` ignora `.idea/` e `.trae/`, mas os ficheiros de
  `.idea/` na **raiz** e em **`Backend/`** continuam **rastreados** — foram adicionados
  antes da regra existir, e o `.gitignore` não desrastreia nada. Incluem
  `dataSources.xml` (com a URL JDBC) e `awsToolkit.xml`. Para limpar:
  `git rm -r --cached .idea 05_Artefactos/Backend/.idea`
- **Esquema da BD:** altera-se nos scripts SQL em
  `Backend/config/database/init/docker_sql_and_sh/`, nunca com `create_all` do SQLAlchemy.
- **Finais de linha:** os ficheiros que correm em Linux (`.sh`, `.conf`, `.yaml`) usam
  LF; o `Infraestrutura/.gitattributes` garante isso.
