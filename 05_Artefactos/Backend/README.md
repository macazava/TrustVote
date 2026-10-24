# Backend do TrustVote

API do TrustVote em **FastAPI** (Python 3.12), com PostgreSQL via SQLAlchemy 2.

| Módulo | Estado |
|---|---|
| Autenticação: registo, login, Argon2, JWT RS256, TOTP (2FA) | ✅ implementado e testado |
| Utilizadores e permissões (eleitor / administrador) | ✅ implementado e testado |
| Gestão eleitoral: eleições, rondas (1.ª e 2.ª volta), candidatos, habilitações | ✅ implementado e testado |
| Auditoria das operações acima (tabela `auditoria`) | ✅ registo; sem encadeamento de hashes |
| Votação, apuramento/resultados, worker, IA | ⏳ por fazer (outros elementos do grupo) |

## Estrutura

```text
Backend/
├── main.py                 # cria a app, inclui os routers, /health, erros -> HTTP
├── app/
│   ├── config.py           # configuração (variáveis de ambiente / Docker secrets)
│   ├── database.py         # engine, sessões, get_db
│   ├── models/             # ORM: utilizador, eleicao (eleição, ronda, candidato, habilitação), auditoria
│   ├── schemas/            # validação de entrada/saída (Pydantic)
│   ├── repositories/       # consultas à BD
│   ├── services/           # regras de negócio (autenticacao.py, eleicao.py, auditoria.py, erros.py)
│   ├── routers/            # rotas HTTP (autenticacao.py, eleicoes.py)
│   ├── security/           # passwords (Argon2), tokens (JWT RS256), totp (AES-GCM), dependencias (acesso)
│   ├── scripts/            # gerar_segredos.py, criar_admin.py
│   └── testes/             # pytest (contra PostgreSQL real)
├── config/database/init/docker_sql_and_sh/trustvote.sql   # esquema da BD (fonte única)
├── Dockerfile              # porta 8080, healthcheck em /health
├── requirements.txt / requirements-dev.txt
└── pytest.ini
```

## Executar (Docker — recomendado)

O backend corre nas duas instâncias (`servidor1`, `servidor2`) da infraestrutura em
`05_Artefactos/Infraestrutura` (ver o README dessa pasta). Na primeira vez:

```powershell
cd 05_Artefactos\Backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-dev.txt
# chaves JWT + chave TOTP, partilhadas pelas duas instâncias (pasta fora do git)
.\.venv\Scripts\python.exe -m app.scripts.gerar_segredos ..\Infraestrutura\secrets

cd ..\Infraestrutura
docker compose -f compose.yaml -f compose.debug.yaml up -d --build --wait
# primeiro administrador (o registo público só cria eleitores)
docker compose exec servidor1 python -m app.scripts.criar_admin admin@trustvote.pt "Administrador"
```

- API (via nginx): <http://127.0.0.1:8080>
- Documentação interativa (Swagger): <http://127.0.0.1:8080/docs>

Depois de alterar código do backend: `docker compose up -d --build servidor1 servidor2`.

> **Atenção:** os scripts SQL só correm com o volume da BD vazio. Depois de alterar o
> `trustvote.sql` é preciso `docker compose down -v` (apaga os dados) e voltar a arrancar.

## Executar localmente (sem Docker para a API)

Com a BD da infraestrutura publicada pelo `compose.debug.yaml` (127.0.0.1:15432):

```powershell
$env:DATABASE_HOST="127.0.0.1"; $env:DATABASE_PORT="15432"; $env:DATABASE_PASSWORD="<TRUSTVOTE_DB_PASSWORD>"
$env:JWT_PRIVATE_KEY_FILE="..\Infraestrutura\secrets\jwt_private.pem"
$env:JWT_PUBLIC_KEY_FILE="..\Infraestrutura\secrets\jwt_public.pem"
$env:TOTP_ENCRYPTION_KEY_FILE="..\Infraestrutura\secrets\totp_key.txt"
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --port 8080
```

## Configuração

| Variável | Descrição |
|---|---|
| `DATABASE_HOST/PORT/NAME/USER/PASSWORD` | ligação ao PostgreSQL (ou `DATABASE_URL`) |
| `JWT_PRIVATE_KEY_FILE` / `JWT_PUBLIC_KEY_FILE` | chaves RSA PEM (ou `JWT_PRIVATE_KEY`/`JWT_PUBLIC_KEY` com o conteúdo) |
| `TOTP_ENCRYPTION_KEY_FILE` | chave AES-256 em base64 que cifra os segredos TOTP (ou `TOTP_ENCRYPTION_KEY`) |
| `JWT_MINUTOS` | validade do token (por omissão 30) |
| `APP_INSTANCE` | nome da instância (aparece em `/health`) |

A app recusa arrancar se faltarem as chaves.

## API

Autenticação: `Authorization: Bearer <access_token>` (obtido em `/auth/login`).

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/health` | público | 200 se a instância chega à BD, 503 se não |
| POST | `/auth/registo` | público | cria conta de **eleitor** |
| POST | `/auth/login` | público | `{email, password, codigo_totp?}` → token JWT |
| GET | `/auth/eu` | autenticado | dados da própria conta |
| POST | `/auth/totp/configurar` | autenticado | gera segredo + URI `otpauth://` (QR code) |
| POST | `/auth/totp/ativar` · `/desativar` | autenticado | confirmar com um código de 6 dígitos |
| GET | `/utilizadores?perfil=` | admin | listar contas |
| PATCH | `/utilizadores/{id}` | admin | `{perfil?, ativo?}` |
| GET | `/eleicoes?estado=` | autenticado | admin: todas · eleitor: só onde está habilitado |
| GET | `/eleicoes/{id}` | autenticado | detalhe com rondas e candidatos (mesma regra) |
| POST · PATCH · DELETE | `/eleicoes` · `/eleicoes/{id}` | admin | criar / editar / apagar |
| POST | `/eleicoes/{id}/agendar` · `/iniciar` · `/encerrar` | admin | mudanças de estado |
| POST · PATCH | `/eleicoes/{id}/rondas` · `/rondas/{n}` | admin | criar ronda 1 ou 2.ª volta / alterar datas |
| POST | `/eleicoes/{id}/rondas/{n}/abrir` · `/encerrar` | admin | abrir 2.ª volta / encerrar ronda |
| POST · PATCH · DELETE | `/eleicoes/{id}/candidatos[/{cid}]` | admin | gerir candidatos |
| GET · POST · DELETE | `/eleicoes/{id}/habilitados[/{uid}]` | admin | habilitar eleitores (`{utilizador_ids: [...]}`) |

Erros: `401` não autenticado · `403` sem permissão · `404` não existe (ou não visível) ·
`409` operação incompatível com o estado atual · `422` dados inválidos.

## Regras implementadas

**Autenticação e permissões**
- Passwords com **Argon2id**; mínimo 8 caracteres com letras e números.
- Login com mensagem de erro igual para email inexistente e password errada, e tempo de resposta
  semelhante (hash fictício), para não revelar que contas existem.
- **JWT RS256** (validade 30 min): assinado com a chave privada, validado só com `algorithms=["RS256"]`
  (recusa `none` e HS256 com a chave pública). As duas instâncias usam o mesmo par de chaves.
- O perfil e o estado `ativo` são lidos **da BD em cada pedido**, não do token: desativar ou despromover
  uma conta tem efeito imediato.
- O registo público só cria eleitores; admins são criados com `criar_admin` ou promovidos por outro admin.
  Um admin não pode retirar o seu próprio acesso.
- **TOTP**: segredo guardado cifrado com **AES-256-GCM**; janela de ±30 s; o último passo usado é guardado
  e um código **não pode ser reutilizado** (com bloqueio de linha, mesmo entre instâncias).

**Ciclo de vida da eleição**

```
rascunho ──agendar──> agendada ──iniciar──> em_curso ──encerrar──> encerrada
```

| Operação | Estados permitidos | Outras condições |
|---|---|---|
| editar título/descrição | rascunho, agendada | |
| apagar eleição | rascunho | |
| candidatos (criar/editar/apagar) | rascunho | |
| criar ronda 1 / alterar datas | rascunho (datas também em agendada) | `data_fim > data_inicio`, datas com fuso |
| habilitar / desabilitar eleitores | rascunho, agendada | só eleitores ativos |
| agendar | rascunho | ronda 1 com fim no futuro, ≥ 2 candidatos ativos, ≥ 1 habilitado; fixa os candidatos da ronda 1 |
| iniciar | agendada | abre a ronda 1 |
| criar 2.ª volta | em_curso | ronda 1 encerrada; exatamente 2 candidatos da ronda 1; começa depois do fim da ronda 1 |
| abrir ronda 2 / encerrar ronda | em_curso | |
| encerrar eleição | em_curso | fecha as rondas abertas |

Eleitores só veem eleições em que estão habilitados e que não estão em rascunho (as outras dão 404).
As mudanças de estado fazem `SELECT ... FOR UPDATE` na eleição: dois pedidos simultâneos, mesmo em
instâncias diferentes, não deixam a eleição inconsistente (testado).

## Testes

```powershell
.\.venv\Scripts\python.exe -m pytest
```

Correm contra o PostgreSQL da infraestrutura (`compose.debug.yaml`, porta 15432) num schema isolado
`tv_testes`, criado a partir do `trustvote.sql` e apagado no fim. Os dados da aplicação não são tocados.
Outra BD: definir `TEST_DATABASE_URL`.

34 testes: registo, login, ataques ao JWT (outra chave, HS256, `none`, expirado), contas desativadas,
permissões, TOTP (cifra, reutilização de códigos, fluxo completo), ciclo de vida da eleição com 2.ª volta,
transições inválidas, habilitações, visibilidade para eleitores e concorrência.

## Para quem vai implementar a votação

- Utilizador autenticado: `from app.security.dependencias import UtilizadorAtual, DbSession`.
- Um voto só deve ser aceite se: a eleição está `em_curso`, a ronda está `aberta`, **e** a hora atual
  está entre `data_inicio` e `data_fim` da ronda (RF08), o eleitor está em `habilitacao` e o candidato
  está em `ronda_candidato`.
- `participacao` + `voto` na **mesma transação** (o `UNIQUE` de `participacao` impede o voto duplicado, RF07).
- Erros de negócio: lançar as exceções de `app/services/erros.py`.
