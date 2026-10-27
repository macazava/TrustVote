# 3. Regras e Restrições

As regras estão em **dois níveis**: as que a própria base de dados garante (não se conseguem violar,
nem com acesso direto à BD) e as que a API garante antes de escrever.

## 3.1 Garantidas pela base de dados

### Chaves estrangeiras e o que acontece ao apagar

| Tabela | Coluna(s) | Referencia | Ao apagar o pai |
|---|---|---|---|
| `eleicao` | `ele_ut_id` | `utilizador` | bloqueia (não se apaga quem criou eleições) |
| `ronda` | `ron_ele_id` | `eleicao` | **CASCADE** (apaga as rondas) |
| `candidato` | `cand_ele_id` | `eleicao` | **CASCADE** |
| `ronda_candidato` | `rc_ron_id` / `rc_cand_id` | `ronda` / `candidato` | **CASCADE** |
| `habilitacao` | `hab_ele_id` / `hab_ut_id` | `eleicao` / `utilizador` | **CASCADE** |
| `participacao` | `part_ron_id` / `part_ut_id` | `ronda` / `utilizador` | bloqueia (protege votos já registados) |
| `voto` | (`vot_ron_id`, `vot_cand_id`) | `ronda_candidato` | bloqueia — **só se vota num candidato que concorre nessa ronda** |
| `resultado` | (`res_ron_id`, `res_cand_id`) | `ronda_candidato` | bloqueia |
| `auditoria` | `aud_ut_id` | `utilizador` | **SET NULL** (o registo fica, sem o utilizador) |

### Unicidade

| Restrição | Garante |
|---|---|
| `utilizador.ut_email` UNIQUE | não há duas contas com o mesmo email |
| `ronda (ron_ele_id, ron_numero)` UNIQUE | cada eleição tem no máximo uma ronda 1 e uma ronda 2 |
| `participacao (part_ron_id, part_ut_id)` UNIQUE | **um eleitor vota uma única vez por ronda (RF07)**, mesmo com pedidos simultâneos |
| `resultado (res_ron_id, res_cand_id)` UNIQUE | um resultado por candidato e ronda |
| chaves primárias compostas de `ronda_candidato` e `habilitacao` | sem repetições |

### CHECK

| Restrição | Regra |
|---|---|
| `ut_ck_perfil` | `ut_perfil` ∈ {`eleitor`, `administrador`} |
| `ele_ck_estado` | `ele_estado` ∈ {`rascunho`, `agendada`, `em_curso`, `encerrada`} |
| `ron_ck_estado` | `ron_estado` ∈ {`agendada`, `aberta`, `encerrada`, `apurada`} |
| `ron_ck_numero` | `ron_numero` ∈ {1, 2} |
| `ron_ck_periodo` | `ron_data_fim > ron_data_inicio` |

### Índices

| Índice | Para |
|---|---|
| chaves primárias e UNIQUE (automáticos) | pesquisas por id, email, ronda+utilizador |
| `ix_ronda_eleicao` | rondas de uma eleição |
| `ix_candidato_eleicao` | candidatos de uma eleição |
| `ix_voto_ronda_candidato` | contagem dos votos no apuramento |
| `ix_auditoria_utilizador` | auditoria de um utilizador |
| `ix_auditoria_acao_data` | auditoria por tipo de ação e data |

## 3.2 Garantidas pela API (backend)

### Estados da eleição

```
rascunho ──agendar──> agendada ──iniciar──> em_curso ──encerrar──> encerrada
```

| Operação | Só em | Outras condições |
|---|---|---|
| editar título/descrição | rascunho, agendada | |
| apagar eleição | rascunho | |
| criar/editar/apagar candidatos | rascunho | |
| habilitar/desabilitar eleitores | rascunho, agendada | só eleitores ativos |
| agendar | rascunho | ronda 1 com fim no futuro, ≥ 2 candidatos ativos, ≥ 1 eleitor habilitado |
| iniciar | agendada | abre a ronda 1 |
| criar 2.ª volta | em_curso | ronda 1 encerrada; exatamente 2 candidatos da ronda 1; começa depois do fim da ronda 1 |
| encerrar | em_curso | fecha as rondas abertas |

### Estados da ronda

```
agendada ──abrir──> aberta ──encerrar (admin ou fim do período)──> encerrada ──apurar──> apurada
```

### Voto (RF06–RF08)

Só é aceite se, **no mesmo instante**: eleição `em_curso`; eleitor habilitado; ronda `aberta`;
hora atual entre `ron_data_inicio` e `ron_data_fim`; candidato em `ronda_candidato` dessa ronda.
`participacao` e `voto` são escritos na **mesma transação**.

### Concorrência (duas instâncias da API)

| Situação | Como é tratada |
|---|---|
| Duas mudanças de estado na mesma eleição ao mesmo tempo | `SELECT … FOR UPDATE` na linha da eleição: a segunda espera e depois é recusada |
| Encerrar a ronda enquanto alguém vota | o voto lê a eleição com `FOR SHARE`; o encerramento espera que o voto termine |
| O mesmo eleitor vota duas vezes ao mesmo tempo | `UNIQUE` de `participacao`: só um voto fica |
| Dois registos de auditoria ao mesmo tempo | advisory lock do PostgreSQL: a cadeia de hashes fica sempre linear |
