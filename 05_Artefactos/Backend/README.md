# Backend do TrustVote

API do TrustVote em **FastAPI** (Python 3.12), com PostgreSQL via SQLAlchemy 2.

| Módulo | Estado |
|---|---|
| Autenticação: registo, login, Argon2, JWT RS256, TOTP (2FA), logout | ✅ implementado e testado |
| Passwords: alterar, repor com código do admin ou com TOTP; bloqueio após tentativas falhadas | ✅ implementado e testado |
| Utilizadores e permissões (eleitor / administrador) | ✅ implementado e testado |
| Gestão eleitoral: eleições, rondas (1.ª e 2.ª volta), candidatos, habilitações | ✅ implementado e testado |
| **Votação** (RF06–RF08): voto anónimo, um por ronda, só no período, recibo verificável | ✅ implementado e testado |
| **Apuramento e resultados** (RF09–RF10): contagem, integridade dos votos, vencedor / 2.ª volta | ✅ implementado e testado |
| **Worker**: encerra rondas no fim do período e apura automaticamente | ✅ implementado e testado |
| **Auditoria** (RF11): registo, consulta e cadeia de hashes contra adulterações | ✅ implementado e testado |
| Previsão por IA | ⏳ por fazer (UC de Inteligência Artificial) |

## Estrutura

```text
Backend/
├── main.py                 # cria a app, inclui os routers, /health, erros -> HTTP
├── app/
│   ├── config.py           # configuração (variáveis de ambiente / Docker secrets)
│   ├── database.py         # engine, sessões, get_db
│   ├── redis_client.py     # ligação ao Redis (estado partilhado pelas instâncias)
│   ├── models/             # ORM: utilizador, eleicao (eleição, ronda, candidato, habilitação),
│   │                       #      votacao (participação, voto, resultado), auditoria
│   ├── schemas/            # validação de entrada/saída (Pydantic)
│   ├── repositories/       # consultas à BD
│   ├── services/           # regras de negócio: autenticacao, eleicao, votacao, apuramento, auditoria, erros
│   ├── routers/            # rotas HTTP: autenticacao, eleicoes, votacao (+ resultados e auditoria)
│   ├── security/           # passwords (Argon2), tokens (JWT RS256), totp (AES-GCM), integridade (HMAC/hashes),
│   │                       # estado_partilhado (Redis: bloqueio de login, logout, códigos), dependencias (acesso)
│   ├── worker/             # processo de fundo: encerra rondas e apura (python -m app.worker)
│   ├── scripts/            # gerar_segredos.py, criar_admin.py
│   └── testes/             # pytest (contra PostgreSQL e Redis reais)
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
- Frontend (servido pelo nginx, mesma origem da API): <http://127.0.0.1:8080/app/>
- Documentação interativa (Swagger): <http://127.0.0.1:8080/docs>

O frontend também pode ser aberto noutra origem (ex.: Live Server do VS Code em `:5500`): a API
aceita pedidos de qualquer origem (CORS, configurável com `CORS_ORIGINS`).

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
| `REDIS_HOST/PORT/PASSWORD` | Redis partilhado (bloqueio de login, logout, códigos de reposição) |
| `LOGIN_MAX_TENTATIVAS` / `LOGIN_JANELA_SEGUNDOS` | bloqueio após falhas (por omissão 5 em 15 min) |
| `RESET_CODIGO_MINUTOS` | validade do código de reposição de password (por omissão 30) |
| `WORKER_INTERVALO` | segundos entre ciclos do worker (por omissão 10) |
| `CORS_ORIGINS` | origens do frontend autorizadas, separadas por vírgulas (por omissão `*`) |

A app recusa arrancar se faltarem as chaves.

## API

Autenticação: `Authorization: Bearer <access_token>` (obtido em `/auth/login`).

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| GET | `/health` | público | 200 se a instância chega à BD, 503 se não |
| POST | `/auth/registo` | público | cria conta de **eleitor** |
| POST | `/auth/login` | público | `{email, password, codigo_totp?}` → token JWT |
| GET | `/auth/eu` | autenticado | dados da própria conta |
| POST | `/auth/logout` | autenticado | invalida o token usado |
| POST | `/auth/password/alterar` | autenticado | `{password_atual, nova_password}`; termina todas as sessões |
| POST | `/auth/password/redefinir` | público | `{email, nova_password, codigo_reset \| codigo_totp}` |
| POST | `/utilizadores/{id}/codigo-reset` | admin | gera código de reposição (uso único, 30 min) |
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
| POST | `/eleicoes/{id}/rondas/{n}/votos` | eleitor habilitado | `{candidato_id}` → `{recibo, hash, data, eleicao_id, ronda}` |
| GET | `/eleicoes/{id}/participacao` | autenticado | `{votou, ronda, rondas}`: se já votou na ronda atual |
| GET | `/eleicoes/{id}/minha-participacao` | eleitor | em que rondas já votou |
| GET | `/votos/{recibo}` | autenticado | confirma que o voto foi registado e não alterado (sem mostrar o candidato) |
| GET | `/recibos/{codigo}/verificar` | autenticado | o mesmo, no formato do frontend (`valido`, `incluido`, `ronda`) |
| POST | `/eleicoes/{id}/rondas/{n}/apurar` | admin | apurar uma ronda encerrada (o worker faz isto sozinho) |
| GET | `/eleicoes/{id}/resultados` | autenticado | lista por ronda `{ronda, apurada, provisorio, total_votos, candidatos[{id, nome, partido, total_votos, percentagem}], decisao}`; eleitores só veem rondas apuradas, admins também a contagem provisória |
| GET | `/eleicoes/{id}/estatisticas` | admin | `{habilitados, votantes, participacao, serie[{hora, votos}], rondas}` (ronda atual + votos por hora) |
| GET | `/eleicoes/{id}/sondagem` | autenticado | projeção da sondagem (simulação, não é o voto) |
| POST | `/eleicoes/{id}/sondagem/respostas` | autenticado | `{candidato_id}`, uma resposta anónima por pessoa |
| GET | `/publico/resumo` | público | eleição em destaque, candidatos, eleitores, votos e participação |
| GET | `/auditoria?acao=&utilizador_id=&entidade=&entidade_id=&limite=&antes_de=` | admin | registos, mais recentes primeiro (`acao` aceita `*`) |
| GET | `/auditoria/verificar` | admin | recalcula a cadeia de hashes e aponta o 1.º registo adulterado |

Erros: `401` não autenticado · `403` sem permissão · `404` não existe (ou não visível) ·
`409` operação incompatível com o estado atual · `422` dados inválidos · `429` demasiadas tentativas ·
`503` serviço auxiliar (Redis) indisponível.

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
- **Bloqueio de força bruta**: 5 falhas (password, TOTP ou código de reposição) bloqueiam o email 15 min
  (`429`), contadas no Redis e por isso iguais nas duas instâncias.
- **Logout** revoga o token no Redis; **mudar ou repor a password** revoga todos os tokens anteriores.
- **Reposição de password** sem servidor de email: código de uso único gerado por um admin (só o hash
  fica no Redis, expira em 30 min) ou o código da app autenticadora, se o TOTP estiver ativo.
- Se o Redis falhar, o login e a verificação de tokens continuam a funcionar sem o bloqueio/revogação
  (registado no log), para a votação não parar por um serviço auxiliar; logout e códigos dão `503`.

**Votação (RF06–RF08)**
- Um voto só é aceite se a eleição está `em_curso`, o eleitor está habilitado, a ronda está `aberta`,
  **a hora atual está entre `data_inicio` e `data_fim`** e o candidato concorre nessa ronda.
  Administradores não votam.
- **Anonimato**: `participacao` guarda quem votou (sem candidato) e `voto` guarda em quem (sem eleitor
  nem hora, id UUID aleatório). A auditoria regista que alguém votou, nunca o candidato.
- **Um voto por ronda**: participação e voto na mesma transação; o `UNIQUE` da participação impede o
  duplicado mesmo com dois pedidos simultâneos em instâncias diferentes (testado).
- **Integridade**: `vot_hash` = HMAC-SHA256 (chave derivada da `TOTP_ENCRYPTION_KEY`). Alterar o candidato
  de um voto na BD é detetado. O **recibo** (id do voto) deixa o eleitor confirmar que o voto foi contado.

**Apuramento e resultados (RF09–RF10)**
- Só rondas encerradas. Verifica o HMAC de cada voto (adulterados não contam e são reportados) e
  confirma que o número de votos é igual ao de participações (`consistente`).
- Ronda 1: vence quem tiver **mais de 50%**; senão passam os 2 mais votados à 2.ª volta. Ronda 2: vence o
  mais votado. Empates ficam assinalados (`empate`) para decisão do admin.
- Os eleitores só veem resultados depois de apurados. Os administradores veem a contagem provisória
  (votos válidos) das rondas abertas, para acompanhar a votação na área da equipa.
- Não existe lista de recibos no servidor: guardar que recibo é de que eleitor quebrava o anonimato.
  O frontend guarda os recibos no próprio dispositivo e verifica-os em `/recibos/{codigo}/verificar`.
- O **worker** (`python -m app.worker`, serviço `worker` no Docker) encerra as rondas cujo período acabou
  e apura-as, a cada 10 s. É seguro correr vários: cada ação bloqueia a eleição e volta a confirmar o estado.

**Auditoria (RF11)**
- Cada registo guarda o hash do anterior (cadeia SHA-256); `/auditoria/verificar` deteta registos
  alterados ou apagados. A escrita usa um advisory lock para a cadeia ser linear com duas instâncias.
- Registos antigos sem hash no início da tabela (de antes desta funcionalidade) contam à parte.

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

Correm contra o PostgreSQL e o Redis da infraestrutura (`compose.debug.yaml`: BD em 15432, Redis em
16379), num schema isolado `tv_testes` (criado a partir do `trustvote.sql` e apagado no fim) e com chaves
Redis com o prefixo `tv_testes:`. Os dados da aplicação não são tocados. Outra BD: `TEST_DATABASE_URL`.

60 testes:
- **autenticação** (14): registo, login, ataques ao JWT (outra chave, HS256, `none`, expirado), contas
  desativadas, permissões;
- **TOTP** (6): cifra, reutilização de códigos, fluxo completo;
- **passwords e sessões** (6): bloqueio após falhas, logout, alterar, repor com código e com TOTP;
- **gestão eleitoral** (14): ciclo de vida com 2.ª volta, transições inválidas, habilitações, visibilidade,
  concorrência;
- **votação** (6): voto anónimo e recibo, duplicado, dois votos simultâneos, quem pode votar, período;
- **apuramento** (6): vencedor, 2.ª volta, empate/sem votos, voto adulterado, estatísticas, worker;
- **auditoria** (4): consulta e filtros, adulteração e remoção detetadas, registos antigos;
- **frontend** (4): participação, recibos, resumo público, sondagem e CORS.

## Limitações conhecidas
- A ordem física das linhas na BD pode, em teoria, permitir a quem tenha acesso direto ao PostgreSQL
  relacionar a ordem das participações com a dos votos; a API nunca expõe essa relação.
- Trocar a `TOTP_ENCRYPTION_KEY` torna ilegíveis os segredos TOTP e os votos deixam de ser verificáveis.
