# TrustVote

Sistema de votação eletrónica — **API FastAPI + PostgreSQL + Redis**, a correr em
Docker num único PC Windows.

Este README é o **ponto de entrada**: explica o que existe no repositório, como
pôr tudo a funcionar do zero e onde está a documentação detalhada. Quem pega no
código pela primeira vez deve começar por aqui.

---

## 1. O que existe neste repositório

```text
05_Artefactos/
├── Backend/            # API (FastAPI + SQLAlchemy + PostgreSQL)
├── Infraestrutura/     # Docker Compose: nginx, aplicações, PostgreSQL e Redis
├── README.md           # este ficheiro — visão geral e como começar
├── ApresentaçãoTrustVote_1aEntrega.pdf
└── Relatório_TrustVote_1aEntrega (1).pdf
```

| Pasta | O que é | Documentação detalhada |
|---|---|---|
| [`Backend/`](Backend/README.md) | API REST: autenticação (Argon2, JWT RS256, TOTP), utilizadores, eleições, rondas, candidatos, habilitações | [Backend/README.md](Backend/README.md) |
| [`Infraestrutura/`](Infraestrutura/README.md) | `compose.yaml` com nginx (balanceador), 2 instâncias, PostgreSQL primário + réplica e Redis | [Infraestrutura/README.md](Infraestrutura/README.md) |

Cada pasta tem o seu próprio README, com todos os detalhes. Este documento só
dá o essencial para arrancar.

---

## 2. Arquitetura em duas linhas

```text
   browser
      │
      ▼
   nginx :8080 ──► servidor1 ─┐
   (balanceador) ► servidor2 ─┤
                              ├──► db-primary ◄──(streaming)── db-replica
                              └──► redis
```

- **`Infraestrutura/`** sobe toda esta stack com Docker, num único PC.
- **`Backend/`** é a aplicação. O Compose constrói a imagem a partir desta pasta e corre-a
  nas duas instâncias (`servidor1`, `servidor2`), na porta **`8080`**, atrás do nginx.

---

## 3. Pré-requisitos

- **Docker Desktop** iniciado (Windows 10/11 com WSL 2).
- **Python 3.12 ou superior**.
- Portas livres: `8080` (nginx) e `15432`/`15433` (base de dados, apenas em modo debug).

---

## 4. Começar do zero (passo a passo)

### Passo 1 — Preparar o Python e gerar os segredos do backend

As duas instâncias partilham as chaves JWT (RS256) e a chave que cifra os segredos TOTP.
Ficam em `Infraestrutura/secrets/` (fora do git). Só é preciso fazer isto **uma vez**:

```powershell
cd "C:\...\05_Artefactos\Backend"
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
.\.venv\Scripts\python.exe -m app.scripts.gerar_segredos ..\Infraestrutura\secrets
```

### Passo 2 — Subir tudo (infraestrutura + API)

```powershell
cd "C:\...\05_Artefactos\Infraestrutura"
copy .env.example .env
# Abre o .env e substitui TODOS os valores "mudar_*" por passwords próprias.
docker compose -f compose.yaml -f compose.debug.yaml up -d --build --wait
docker compose ps
```

O `--wait` só devolve quando todos os contentores estão `healthy` (o healthcheck da API
inclui a ligação à base de dados). O `compose.debug.yaml` publica a base de dados em
`127.0.0.1:15432`, para a veres no pgAdmin e para os testes do backend.

### Passo 3 — Criar o primeiro administrador

O registo público só cria eleitores. O administrador cria-se com um script:

```powershell
docker compose exec servidor1 python -m app.scripts.criar_admin admin@trustvote.pt "Administrador"
```

### Passo 4 — Confirmar que funciona

- Documentação interativa (Swagger): <http://127.0.0.1:8080/docs> — botão **Authorize** para colar o token
- Healthcheck: <http://127.0.0.1:8080/health> (alterna entre `servidor1` e `servidor2`)
- Testes automáticos: `cd Backend` e `.\.venv\Scripts\python.exe -m pytest` (34 testes)

Depois de alterar código do backend: `docker compose up -d --build servidor1 servidor2`.

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
- `app/security/` — passwords (Argon2), tokens JWT RS256, TOTP e dependências de autorização.
- `app/services/erros.py` — erros de negócio traduzidos em `401`/`403`/`404`/`409`/`422`.
- `app/testes/` — testes pytest contra o PostgreSQL real (schema isolado `tv_testes`).
- `config/database/init/` — scripts SQL canónicos do esquema (a BD é a fonte da verdade).

Detalhes em [Backend/README.md](Backend/README.md).

---

## 7. O que ainda falta

Estado atual, em resumo:

**Backend** — feito: registo e login (Argon2, JWT RS256, TOTP), utilizadores e
permissões, gestão de eleições/rondas (com 2.ª volta)/candidatos/habilitações com regras
de estado, e registo na auditoria; 34 testes. Falta: **voto** e **apuramento de
resultados**, reset de password, encadeamento de hashes na auditoria, worker e uso do Redis.

**Infraestrutura** — feito: stack completa a funcionar com o backend real nas duas
instâncias (balanceamento, replicação, failover manual testados).

**Frontend** — em branches próprias (`taha`, `Camila`); ainda não chama a API.

Listas completas em [Backend/README.md](Backend/README.md) e
[Infraestrutura/README.md](Infraestrutura/README.md).

---

## 8. Problemas comuns

| Sintoma | Causa provável / solução |
|---|---|
| `secret ... not found` / `jwt_private.pem` em falta | Falta gerar os segredos. Ver Passo 1. |
| `servidor1`/`servidor2` ficam `unhealthy` | A API não chega à BD ou falta configuração; ver `docker compose logs servidor1`. |
| Alterações ao código não aparecem | A imagem não foi reconstruída: `docker compose up -d --build servidor1 servidor2`. |
| Testes: "PostgreSQL de testes indisponível" | Arranca a infraestrutura com o `compose.debug.yaml` (BD em `15432`). |
| `docker compose up` recusa arrancar | Falta uma password no `.env` da Infraestrutura. Copia o `.env.example` e preenche os `mudar_*`. |
| `port is already allocated` | A porta está ocupada (ex.: outro PostgreSQL na `5432`). Fecha o processo ou muda a porta no `.env`. |
| Tabelas novas não aparecem na BD | Os scripts SQL só correm com o volume vazio. Ver [Infraestrutura > Scripts de inicialização](Infraestrutura/README.md). |
| `docker compose` não responde | O Docker Desktop está desligado. Confirma com `docker info`. |

---

## 9. Convenções

- **Língua:** código, comentários e documentação em português (Portugal).
- **Segredos:** nunca guardar passwords reais em ficheiros versionados. O
  `Infraestrutura/.env`, a pasta `Infraestrutura/secrets/` e qualquer `.env` do backend
  estão no `.gitignore`. A configuração do backend vem do `compose.yaml`.
- **Esquema da BD:** altera-se nos scripts SQL em
  `Backend/config/database/init/docker_sql_and_sh/`, nunca com `create_all` do SQLAlchemy.
- **Finais de linha:** os ficheiros que correm em Linux (`.sh`, `.conf`, `.yaml`) usam
  LF; o `Infraestrutura/.gitattributes` garante isso.
