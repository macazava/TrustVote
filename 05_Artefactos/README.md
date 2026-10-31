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
  `Frontend/js/models/servidor.js`), e o `CORS_ORIGINS` do backend autoriza só esse endereço.
- O **nginx** encaminha `/api/` para `servidor1`/`servidor2`, que correm a imagem do
  `Backend/`. Quem abrir `http://127.0.0.1:8080/` é reencaminhado para o Live Server.
- O frontend não tem dados próprios: tudo o que mostra vem da API.

---

## 3. Pré-requisitos

- **Docker Desktop** iniciado (Windows 10/11 com WSL 2).
- **Python 3.12 ou superior**.
- Portas livres: `8080` (nginx), `8001` (API em desenvolvimento) e `15432`/`15433`
  (base de dados, apenas em modo debug).

---

## 4. Começar do zero (passo a passo)

### Passo 1 — Subir a infraestrutura

```powershell
cd "C:\...\05_Artefactos\Infraestrutura"
copy .env.example .env
# Abre o .env e substitui TODOS os valores "mudar_*" por passwords próprias.
docker compose -f compose.yaml -f compose.debug.yaml up -d --wait
docker compose ps
```

O `--wait` só devolve quando todos os contentores estão `healthy`.

Usamos também o `compose.debug.yaml` porque ele **publica a base de dados em
`127.0.0.1:15432`** — sem isso, o backend a correr fora do Docker não lhe chega.

### Passo 2 — Configurar o backend

O ficheiro `Backend/.env` aponta para a base de dados publicada no passo anterior:

```dotenv
DATABASE_HOST=127.0.0.1
DATABASE_PORT=15432
DATABASE_NAME=trustvote
DATABASE_USER=trustvote
DATABASE_PASSWORD=<o mesmo valor de TRUSTVOTE_DB_PASSWORD do .env da Infraestrutura>
JWT_SECRET=<o mesmo valor de JWT_SECRET do .env da Infraestrutura>
```

### Passo 3 — Instalar dependências e arrancar a API

O ambiente virtual vive na raiz de `05_Artefactos`, em `.venv`.

```powershell
cd "C:\...\05_Artefactos\Backend"
..\.venv\Scripts\python.exe -m pip install -r requirements.txt
..\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 0.0.0.0 --port 8001
```

Se ainda não existir o ambiente virtual:

```powershell
cd "C:\...\05_Artefactos"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r Backend\requirements.txt
```

Usa sempre `--reload` durante o desenvolvimento: sem ele, o servidor continua a
servir o código antigo que tem em memória depois de editares um ficheiro.

### Passo 4 — Confirmar que funciona

- API: <http://localhost:8001/> · healthcheck: <http://localhost:8001/health>
- Documentação interativa (Swagger): <http://localhost:8001/docs>
- Aplicação completa: <http://127.0.0.1:5500/Frontend/pages/inicio.html> (Live Server)
- API através do nginx: <http://localhost:8080/api/health>

O registo exige o **número de estudante** (identificador do eleitor) e a conta é
automaticamente habilitada a votar nas eleições ainda não encerradas. Para testar as
rotas de administração, cria uma conta e promove-a:

```powershell
docker exec trustvote-db-primary psql -U trustvote -d trustvote -c "UPDATE utilizador SET ut_perfil='administrador' WHERE ut_nome='<o teu nome>';"
```

### Passo 5 — Parar

```powershell
cd "C:\...\05_Artefactos\Infraestrutura"
docker compose down          # para tudo, mantém os dados
docker compose down -v       # ATENÇÃO: apaga também os dados
```

---

## 5. Comandos do dia a dia

```powershell
docker compose ps                    # estado + health dos contentores
docker compose logs -f nginx         # seguir os logs de um serviço
docker compose restart servidor1     # reiniciar só uma instância
docker compose up -d --wait          # aplicar alterações ao compose
```

Ligação à base de dados a partir do terminal:

```powershell
docker exec -it trustvote-db-primary psql -U trustvote -d trustvote -c "\dt"
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
eleições, candidaturas, rondas e caderno eleitoral, voto anónimo com recibo,
contagem de resultados e resumo público. Falta: **auditoria**, **sondagem**, TOTP,
worker assíncrono e uso do Redis/réplica.

**Frontend** — ligado à API. As áreas que dependem de rotas em falta mostram que a
funcionalidade ainda não está disponível.

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
| O backend não liga à base de dados | Falta o `compose.debug.yaml` (a BD não está publicada em `15432`) ou as credenciais do `Backend/.env` não coincidem com o `.env` da Infraestrutura. |
| Alterações ao código não aparecem | O servidor não está com `--reload`; para-o e arranca de novo. |
| `docker compose up` recusa arrancar | Falta uma password no `.env` da Infraestrutura. Copia o `.env.example` e preenche os `mudar_*`. |
| `port is already allocated` | A porta está ocupada (ex.: outro PostgreSQL na `5432`). Fecha o processo ou muda a porta no `.env`. |
| Tabelas novas não aparecem na BD | Os scripts SQL só correm com o volume vazio. Ver [Infraestrutura > Scripts de inicialização](Infraestrutura/README.md). |
| `docker compose` não responde | O Docker Desktop está desligado. Confirma com `docker info`. |

---

## 9. Convenções

- **Língua:** código, comentários e documentação em português (Portugal).
- **Segredos:** nunca guardar passwords reais em ficheiros versionados. O
  `Infraestrutura/.env` está no `.gitignore`; o `Backend/.env` **ainda não** — deve
  ser retirado do git e substituído por um `.env.example`.
- **Esquema da BD:** altera-se nos scripts SQL em
  `Backend/config/database/init/docker_sql_and_sh/`, nunca com `create_all` do SQLAlchemy.
- **Finais de linha:** os ficheiros que correm em Linux (`.sh`, `.conf`, `.yaml`) usam
  LF; o `Infraestrutura/.gitattributes` garante isso.
