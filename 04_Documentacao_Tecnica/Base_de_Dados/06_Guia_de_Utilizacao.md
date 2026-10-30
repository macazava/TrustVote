# 6. Guia de Utilização

Pré-requisito: a infraestrutura a correr com o ficheiro de debug (publica a BD neste PC).

```powershell
cd 05_Artefactos\Infraestrutura
docker compose -f compose.yaml -f compose.debug.yaml up -d --wait
```

## 6.1 Ver a BD no pgAdmin 4

> A BD é **PostgreSQL**: o MySQL Workbench não serve.

1. pgAdmin → botão direito em **Servers** → **Register → Server…**
2. **General → Name:** `TrustVote`
3. **Connection:**

| Campo | Valor |
|---|---|
| Host | `127.0.0.1` (ou `localhost`) |
| Port | `15432` (a réplica, só leitura, está em `15433`) |
| Maintenance database | `trustvote` |
| Username | `trustvote` |
| Password | `TRUSTVOTE_DB_PASSWORD` do `.env` da Infraestrutura |

4. Tabelas: **TrustVote → Databases → trustvote → Schemas → public → Tables**.
5. Dados: botão direito numa tabela → **View/Edit Data → All Rows**.
6. Diagrama: botão direito em **trustvote** → **ERD For Database**.

A porta **5432** é de um PostgreSQL instalado no Windows (se existir), não do projeto.

## 6.2 Pelo terminal (psql dentro do contentor)

```powershell
docker compose exec db-primary psql -U trustvote -d trustvote
```

Comandos úteis dentro do psql: `\dt` (tabelas), `\d eleicao` (estrutura de uma tabela), `\q` (sair).
Consultas prontas em [sql/consultas_uteis.sql](sql/consultas_uteis.sql).

## 6.3 Recriar a BD do zero

Os scripts de criação só correm quando o volume está vazio. Para recriar (**apaga todos os dados**):

```powershell
docker compose -f compose.yaml -f compose.debug.yaml down -v
docker compose -f compose.yaml -f compose.debug.yaml up -d --build --wait
docker compose exec servidor1 python -m app.scripts.criar_admin admin@trustvote.pt "Administrador"
```

## 6.4 Alterar o esquema

1. Alterar `05_Artefactos/Backend/config/database/init/docker_sql_and_sh/trustvote.sql`
   (nunca com `create_all` do SQLAlchemy).
2. Atualizar os modelos em `05_Artefactos/Backend/app/models/`.
3. Correr os testes (`cd 05_Artefactos\Backend` e `.\.venv\Scripts\python.exe -m pytest`): criam um
   schema de teste a partir do `trustvote.sql`, por isso apanham logo erros no SQL.
4. Recriar a BD local (6.3) — ou, se houver dados a manter, aplicar a alteração com `ALTER TABLE`.
5. Atualizar esta documentação e voltar a gerar a cópia de referência:

```powershell
cd 05_Artefactos\Infraestrutura
docker compose exec -T db-primary pg_dump -U postgres -d trustvote --schema-only --no-owner --no-privileges --schema=public -f /tmp/esquema.sql
docker cp trustvote-db-primary:/tmp/esquema.sql ..\..\04_Documentacao_Tecnica\Base_de_Dados\sql\esquema_completo.sql
```

(depois, repor o cabeçalho explicativo no início do ficheiro).
