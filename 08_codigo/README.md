# TrustVote

Sistema de votação eletrónica para a **Associação de Estudantes de uma universidade
europeia** — **API FastAPI + PostgreSQL**, a correr em Docker num único PC Windows.
O Redis está configurado na stack, mas ainda não é utilizado pela API.

Este README é o **ponto de entrada**: explica o que existe no repositório, como
pôr tudo a funcionar do zero e onde está a documentação detalhada. Quem pega no
código pela primeira vez deve começar por aqui.

---

## 1. O que existe neste repositório

```text
08_codigo/
├── Backend/            # API (FastAPI + SQLAlchemy + PostgreSQL)
├── Frontend/           # páginas HTML/CSS/JS, servidas pelo Nginx
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

### Navegação

- [Arquitetura](#2-arquitetura)
- [Arranque local](#4-comandos-para-pôr-tudo-a-correr)
- [Problemas comuns](#8-problemas-comuns)
- [Backend](Backend/README.md)
- [Infraestrutura, HTTPS e failover](Infraestrutura/README.md)

---

## 2. Arquitetura

```text
                                  ┌── HTTP :8080 ──301──┐
browser ── HTTPS :8443 ─────────►│ nginx               │
  │                              │ TLS + frontend      │
  │                              │ /api: balanceamento│
  │                              └─────────┬───────────┘
  │                                        │
  │                              ┌─────────┴─────────┐
  │                              ▼                   ▼
  │                         servidor1            servidor2
  │                              └─────────┬─────────┘
  │                                        ▼
  │                          PostgreSQL primário ──WAL──► réplica
  │                                  ▲
  │                               monitor
  │
  └── Redis (logout imediato, limite de tentativas de login, mensagens ao vivo)
```

Se a BD primária falhar enquanto a réplica estiver sincronizada, o monitor promove-a e a API
passa a usá-la sem reiniciar.

- **`Infraestrutura/`** sobe toda esta stack com Docker, num único PC.
- **`Backend/`** é a aplicação; em desenvolvimento corre fora do Docker, na porta
  **`8001`**, ligada ao PostgreSQL da infraestrutura.
- O **Nginx** termina HTTPS, serve os ficheiros do frontend e encaminha `/api/` para
  `servidor1`/`servidor2`. A porta HTTP `8080` redireciona para HTTPS na `8443`.
- O Redis guarda as sessões terminadas (logout imediato) e o limite de tentativas de login;
  se cair, o site continua a funcionar sem essas duas proteções.
- O site abre-se sempre pelo Nginx: <https://127.0.0.1:8443> neste PC, ou
  `https://<IP do PC>:8443` a partir de outro computador da rede (com
  `NGINX_BIND_ADDRESS=0.0.0.0` no `.env`). A página e a API partilham a origem.
- O frontend não guarda os dados eleitorais: obtém-nos através da API.

---

## 3. Pré-requisitos

- **Docker Desktop** iniciado (Windows 10/11 com WSL 2). Confirma com `docker info`.
- **mkcert** instalado, para gerar um certificado HTTPS local (ver
  [Infraestrutura > HTTPS local](Infraestrutura/README.md#5-https-local)).
- **Python 3.12 ou superior** (só é necessário no modo B).
- Portas livres:
  - `8080` — HTTP do Nginx, redireciona para `8443`;
  - `8443` — HTTPS do Nginx, frontend e API;
  - `8001` — API local (só no modo B);
  - `15432` / `15433` / `5050` — base de dados e pgAdmin (só com o `compose.debug.yaml`).

---

## 4. Comandos para pôr tudo a correr

Há **dois modos**, ambos sobre a mesma base de dados e o mesmo frontend:

| Modo | Onde corre a API | Para que serve |
|---|---|---|
| **A. Tudo em Docker** (recomendado) | contentores `servidor1` / `servidor2` | demonstração completa: balanceamento, replicação e failover |
| **B. API local + infraestrutura em Docker** | no teu PC, porta `8001` | desenvolvimento e testes diretos à API, com `--reload` |

### Passo 0 — Uma só vez: ambiente virtual (só é preciso no modo B)

O ambiente virtual vive na raiz de `08_codigo`, em `.venv`.

```powershell
cd "C:\...\08_codigo"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r Backend\requirements.txt
```

### Passo 1 — Criar o `.env` da infraestrutura (só na primeira vez)

```powershell
cd "C:\...\08_codigo\Infraestrutura"
copy .env.example .env
# Abre o .env e substitui TODOS os valores "mudar_*" por passwords próprias.
```

### Passo 2 — Gerar o certificado HTTPS local (só na primeira vez)

Na pasta `Infraestrutura`, gera certificados próprios para este computador:

```powershell
mkcert -install
New-Item -ItemType Directory -Force .\docker\nginx\certs
mkcert -cert-file .\docker\nginx\certs\cert.pem `
  -key-file .\docker\nginx\certs\key.pem `
  localhost 127.0.0.1 ::1
```

Não partilhes nem faças commit da chave privada. A pasta dos certificados é ignorada pelo Git.
Os detalhes estão em [Infraestrutura > HTTPS local](Infraestrutura/README.md#5-https-local).

### Passo 3 — Subir a infraestrutura

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
- No modo B, o frontend continua a chamar a API Docker pelo Nginx. Para testar a API
  local, usa `http://localhost:8001/docs` ou aponta temporariamente o frontend para
  essa API.

### Passo 4 — (Modo B) Configurar e arrancar a API no PC

O `Backend/.env` aponta para a base de dados publicada no passo anterior:

```dotenv
DATABASE_HOST=127.0.0.1
DATABASE_PORT=15432
DATABASE_NAME=trustvote
DATABASE_USER=trustvote
DATABASE_PASSWORD=<o mesmo valor de TRUSTVOTE_DB_PASSWORD do .env da Infraestrutura>
```

```powershell
cd "C:\...\08_codigo\Backend"
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Corre sempre a partir da pasta `Backend`, senão dá
`ModuleNotFoundError: No module named 'app'`. Usa `--reload` durante o
desenvolvimento: sem ele, o servidor continua a servir o código que tem em memória.

### Passo 5 — Abrir o frontend

Abre <https://127.0.0.1:8443> (vai direto para a página inicial). Para abrir a partir
de outro computador da rede (ex.: na apresentação), define `NGINX_BIND_ADDRESS=0.0.0.0`
no `.env`, inclui o IP do PC no certificado e usa `https://<IP do PC>:8443`.
O site é aberto pelo Nginx, que serve a página e a API na mesma origem (HTTPS).

O certificado `mkcert` confia apenas no computador onde foi instalado. O acesso
por omissão está limitado a `127.0.0.1`; não é um endereço para partilhar com
outros dispositivos.

### Passo 6 — Confirmar que funciona

| | Endereço |
|---|---|
| Aplicação pelo Nginx (HTTPS) | <https://127.0.0.1:8443/pages/inicio.html> |
| API através do Nginx | <https://127.0.0.1:8443/api/health> |
| Documentação interativa da API | <https://127.0.0.1:8443/api/docs> |
| Redirecionamento HTTP | <http://127.0.0.1:8080/> → HTTPS |
| API local (só no modo B) | <http://localhost:8001/docs> |
| Pelo IP do PC (outro computador da rede) | `https://<IP do PC>:8443` |
| pgAdmin (com o ficheiro de debug) | <http://127.0.0.1:5050> |

O registo exige o **número de estudante** (identificador do eleitor) e a conta é
automaticamente habilitada a votar nas eleições ainda não encerradas. Para testar as
rotas de administração, cria uma conta e promove-a:

```powershell
docker exec trustvote-db-primary psql -U trustvote -d trustvote -c "UPDATE utilizador SET ut_perfil='administrador' WHERE ut_nome='<o teu nome>';"
```

### Passo 7 — Parar

Desce sempre com o **mesmo conjunto de ficheiros** que usaste para subir:

```powershell
cd "C:\...\08_codigo\Infraestrutura"

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
cd "C:\...\08_codigo\Infraestrutura"

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

**Backend** — feito: registo (com nº de estudante), login com JWT, TOTP opcional,
gestão de eleições, candidaturas, rondas e caderno eleitoral, **voto anónimo com
recibo**, verificação de recibo, contagem de resultados, estatísticas e resumo público.

Falta expor, no backend, as rotas que o frontend já invoca:

| Rota em falta | Área |
|---|---|
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

**Infraestrutura** — feito: stack Docker com Nginx (frontend HTTPS e redirecionamento
HTTP), duas APIs, PostgreSQL primário/réplica, monitor de failover e backups. O acesso
por omissão está limitado ao próprio PC; os certificados `mkcert` são locais. Limitações
em [Infraestrutura > Limitações conhecidas](Infraestrutura/README.md).

Listas completas em [Backend > Próximos passos](Backend/README.md) e
[Infraestrutura > Integração](Infraestrutura/README.md).

---

## 8. Problemas comuns

| Sintoma | Causa provável / solução |
|---|---|
| `ModuleNotFoundError: No module named 'app'` | Estás a correr o Uvicorn fora da pasta `Backend`. Corre `python -m uvicorn main:app ...` a partir de `Backend`. |
| `ERR_CONNECTION_REFUSED` em `localhost:8001` | O Uvicorn não está a correr, ou a porta é outra. Ver Passo 4. |
| `[Errno 10048]` a ligar à porta `8001` | Já há um Uvicorn a segurar a porta (normalmente um processo órfão do `--reload`). Liberta-a com o comando da [secção 5](#5-comandos-do-dia-a-dia). |
| O backend não liga à base de dados | Falta o `compose.debug.yaml` (a BD não está publicada em `15432`) ou as credenciais do `Backend/.env` não coincidem com o `.env` da Infraestrutura. |
| Alterações ao código não aparecem | Sem `--reload` (API local) ou sem `--build` (contentores). Ver [secção 5](#5-comandos-do-dia-a-dia). |
| `502` no nginx, com `no live upstreams` nos logs | As instâncias `servidor1`/`servidor2` estão em baixo, **ou** a imagem do backend está desatualizada (foi construída com outra porta). Sobe com `docker compose up -d --build --wait`. |
| Aviso de certificado ao abrir HTTPS | Confirma que executaste `mkcert -install` e geraste certificados locais; vê [Infraestrutura > HTTPS local](Infraestrutura/README.md#5-https-local). |
| "Não foi possível contactar o servidor" no browser | Confirma `docker compose ps`, testa `https://127.0.0.1:8443/api/health` e verifica se o certificado local é confiável. Se o erro persistir, atualiza a página sem cache (Ctrl+F5). |
| `503` / "Serviço temporariamente indisponível" | A API está viva mas sem acesso à base de dados. Confirma `docker compose ps` e testa `https://127.0.0.1:8443/api/health`. |
| `Resource is still in use` no `docker network rm` | Ficou um contentor órfão (tipicamente o `pgadmin`, ao descer sem o `compose.debug.yaml`). Usa `down --remove-orphans`. |
| `docker compose up` recusa arrancar | Falta uma password no `.env` da Infraestrutura. Copia o `.env.example` e preenche os `mudar_*`. |
| `port is already allocated` | A porta está ocupada (ex.: outro PostgreSQL na `5432`). Fecha o processo ou muda a porta no `.env`. |
| HTTP não abre diretamente a aplicação | É esperado: `http://127.0.0.1:8080` redireciona para `https://127.0.0.1:8443`. |
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
  `git rm -r --cached .idea 08_codigo/Backend/.idea`
- **Esquema da BD:** altera-se nos scripts SQL em
  `Backend/config/database/init/docker_sql_and_sh/`, nunca com `create_all` do SQLAlchemy.
- **Finais de linha:** os ficheiros que correm em Linux (`.sh`, `.conf`, `.yaml`) usam
  LF; o `Infraestrutura/.gitattributes` garante isso.
