# 2. Dicionário de Dados

Convenções: cada coluna tem o prefixo da sua tabela (`ut_`, `ele_`, `ron_`…). Os ids numéricos são
`BIGINT GENERATED ALWAYS AS IDENTITY` (gerados pela BD). Todas as datas são `TIMESTAMPTZ` (com fuso
horário; guardadas em UTC). **Obr.** = obrigatório (`NOT NULL`).

---

## `utilizador` — contas (RF01, RF02)

| Coluna | Tipo | Obr. | Omissão | Descrição |
|---|---|---|---|---|
| `ut_id` | bigint | ✔ | identity | Identificador |
| `ut_nome` | varchar(255) | ✔ | | Nome |
| `ut_email` | varchar(255) | ✔ | | Email, **único**; usado no login (guardado em minúsculas) |
| `ut_password_hash` | varchar(255) | ✔ | | Hash **Argon2id** da password (nunca a password) |
| `ut_perfil` | varchar(20) | ✔ | `'eleitor'` | `eleitor` ou `administrador` |
| `ut_ativo` | boolean | | `true` | Conta desativada = não entra nem é aceite em pedidos |
| `ut_datareg` | timestamptz | | agora | Data de registo |
| `ut_totp_segredo` | text | | | Segredo TOTP (2FA) **cifrado com AES-256-GCM**; `NULL` se não configurado |
| `ut_totp_ativo` | boolean | ✔ | `false` | 2FA ativo |
| `ut_totp_ultimo_passo` | bigint | | | Último passo de 30 s aceite; impede reutilizar um código |

## `eleicao` — eleições (RF03)

| Coluna | Tipo | Obr. | Omissão | Descrição |
|---|---|---|---|---|
| `ele_id` | bigint | ✔ | identity | Identificador |
| `ele_titulo` | varchar(150) | ✔ | | Título (ex.: "Presidenciais 2026") |
| `ele_descricao` | text | | | Descrição |
| `ele_estado` | varchar(50) | ✔ | `'rascunho'` | `rascunho` → `agendada` → `em_curso` → `encerrada` |
| `ele_ut_id` | bigint | ✔ | | Administrador que a criou → `utilizador` |
| `ele_data` | timestamptz | | agora | Data de criação |

## `ronda` — 1.ª e 2.ª volta (RF08)

| Coluna | Tipo | Obr. | Omissão | Descrição |
|---|---|---|---|---|
| `ron_id` | bigint | ✔ | identity | Identificador |
| `ron_ele_id` | bigint | ✔ | | Eleição → `eleicao` |
| `ron_numero` | smallint | ✔ | | `1` ou `2` |
| `ron_data_inicio` | timestamptz | ✔ | | Início do período de votação |
| `ron_data_fim` | timestamptz | ✔ | | Fim do período (tem de ser depois do início) |
| `ron_estado` | varchar(50) | ✔ | `'agendada'` | `agendada` → `aberta` → `encerrada` → `apurada` |

## `candidato` — candidatos (RF04)

| Coluna | Tipo | Obr. | Omissão | Descrição |
|---|---|---|---|---|
| `cand_id` | bigint | ✔ | identity | Identificador |
| `cand_ele_id` | bigint | ✔ | | Eleição → `eleicao` |
| `cand_nome` | varchar(255) | ✔ | | Nome |
| `cand_partido` | varchar(255) | | | Partido ou "Independente" |
| `cand_descricao` | text | | | Apresentação |
| `cand_ativo` | boolean | | `true` | Inativo = não entra na ronda 1 ao agendar |

## `ronda_candidato` — quem concorre em cada ronda

| Coluna | Tipo | Obr. | Descrição |
|---|---|---|---|
| `rc_ron_id` | bigint | ✔ | Ronda → `ronda` (parte da chave primária) |
| `rc_cand_id` | bigint | ✔ | Candidato → `candidato` (parte da chave primária) |

Preenchida pela API: ronda 1 ao **agendar** (todos os candidatos ativos); ronda 2 ao criá-la (os 2 escolhidos).

## `habilitacao` — quem pode votar em cada eleição (RF05)

| Coluna | Tipo | Obr. | Omissão | Descrição |
|---|---|---|---|---|
| `hab_ele_id` | bigint | ✔ | | Eleição → `eleicao` (parte da chave primária) |
| `hab_ut_id` | bigint | ✔ | | Eleitor → `utilizador` (parte da chave primária) |
| `hab_data` | timestamptz | | agora | Data da habilitação |

## `participacao` — QUEM votou (RF07)

| Coluna | Tipo | Obr. | Omissão | Descrição |
|---|---|---|---|---|
| `part_id` | bigint | ✔ | identity | Identificador |
| `part_ron_id` | bigint | ✔ | | Ronda → `ronda` |
| `part_ut_id` | bigint | ✔ | | Eleitor → `utilizador` |
| `part_data` | timestamptz | | agora | Quando votou |

`UNIQUE (part_ron_id, part_ut_id)`: um eleitor só participa uma vez por ronda. **Não tem o candidato.**

## `voto` — EM QUEM se votou (RF06)

| Coluna | Tipo | Obr. | Omissão | Descrição |
|---|---|---|---|---|
| `vot_id` | uuid | ✔ | aleatório | Identificador aleatório (não sequencial); é o **recibo** entregue ao eleitor |
| `vot_ron_id` | bigint | ✔ | | Ronda |
| `vot_cand_id` | bigint | ✔ | | Candidato; (`vot_ron_id`, `vot_cand_id`) → `ronda_candidato` |
| `vot_hash` | char(64) | ✔ | | HMAC-SHA256 de `vot_id|ronda|candidato`; deteta alterações |

**Não tem o eleitor nem a hora** (anonimato).

## `resultado` — apuramento (RF09, RF10)

| Coluna | Tipo | Obr. | Omissão | Descrição |
|---|---|---|---|---|
| `res_id` | bigint | ✔ | identity | Identificador |
| `res_ron_id` | bigint | ✔ | | Ronda |
| `res_cand_id` | bigint | ✔ | | Candidato; (`res_ron_id`, `res_cand_id`) → `ronda_candidato` |
| `res_total_votos` | integer | ✔ | `0` | Votos válidos |
| `res_percentagem` | numeric(5,2) | ✔ | `0` | Percentagem dos votos válidos (ex.: `66.67`) |
| `res_data` | timestamptz | | agora | Data do apuramento |

`UNIQUE (res_ron_id, res_cand_id)`: uma linha por candidato e ronda.

## `auditoria` — registo de operações (RF11)

| Coluna | Tipo | Obr. | Omissão | Descrição |
|---|---|---|---|---|
| `aud_id` | bigint | ✔ | identity | Identificador (define a ordem da cadeia) |
| `aud_ut_id` | bigint | | | Quem fez a ação → `utilizador`; `NULL` = sistema (worker) ou anónimo |
| `aud_acao` | varchar(80) | ✔ | | Ação (ver lista abaixo) |
| `aud_entidade` | varchar(50) | | | Tipo do objeto afetado (`eleicao`, `ronda`, `utilizador`) |
| `aud_entidade_id` | bigint | | | Id do objeto afetado |
| `aud_detalhes` | jsonb | | | Pormenores (nunca passwords nem o candidato votado) |
| `aud_ip` | varchar(45) | | | IP do cliente (IPv4 ou IPv6) |
| `aud_hash_anterior` | char(64) | | | `aud_hash_atual` do registo anterior |
| `aud_hash_atual` | char(64) | | | SHA-256 do anterior + conteúdo deste registo |
| `aud_data` | timestamptz | | agora | Quando |

Ações registadas pela API:

| Área | `aud_acao` |
|---|---|
| Contas | `utilizador.registo`, `utilizador.atualizado` |
| Autenticação | `auth.login`, `auth.login_falhado`, `auth.login_bloqueado`, `auth.logout`, `auth.totp_ativado`, `auth.totp_desativado`, `auth.password_alterada`, `auth.codigo_reset_gerado`, `auth.password_reposta`, `auth.reset_falhado` |
| Eleições | `eleicao.criada`, `eleicao.editada`, `eleicao.apagada`, `eleicao.agendada`, `eleicao.iniciada`, `eleicao.encerrada` |
| Rondas | `ronda.criada`, `ronda.editada`, `ronda.aberta`, `ronda.encerrada`, `ronda.apurada` |
| Candidatos e habilitações | `candidato.criado`, `candidato.editado`, `candidato.apagado`, `habilitacao.adicionada`, `habilitacao.removida` |
| Votação | `voto.registado` |
