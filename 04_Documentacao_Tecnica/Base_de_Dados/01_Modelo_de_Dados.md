# 1. Modelo de Dados

## Diagrama entidade-relação

```mermaid
erDiagram
    UTILIZADOR ||--o{ ELEICAO : "cria (admin)"
    UTILIZADOR ||--o{ HABILITACAO : "é habilitado"
    UTILIZADOR ||--o{ PARTICIPACAO : "vota (quem)"
    UTILIZADOR |o--o{ AUDITORIA : "executa"

    ELEICAO ||--|{ RONDA : "tem 1 ou 2"
    ELEICAO ||--o{ CANDIDATO : "tem"
    ELEICAO ||--o{ HABILITACAO : "habilita"

    RONDA ||--o{ RONDA_CANDIDATO : "concorrem"
    CANDIDATO ||--o{ RONDA_CANDIDATO : "concorre"

    RONDA ||--o{ PARTICIPACAO : "regista quem votou"
    RONDA_CANDIDATO ||--o{ VOTO : "recebe (em quem)"
    RONDA_CANDIDATO ||--o| RESULTADO : "apuramento"

    UTILIZADOR {
        bigint ut_id PK
        varchar ut_email UK
        varchar ut_password_hash "Argon2id"
        varchar ut_perfil "eleitor | administrador"
        text ut_totp_segredo "cifrado AES-GCM"
    }
    ELEICAO {
        bigint ele_id PK
        varchar ele_titulo
        varchar ele_estado "rascunho..encerrada"
        bigint ele_ut_id FK
    }
    RONDA {
        bigint ron_id PK
        bigint ron_ele_id FK
        smallint ron_numero "1 ou 2"
        timestamptz ron_data_inicio
        timestamptz ron_data_fim
        varchar ron_estado "agendada..apurada"
    }
    CANDIDATO {
        bigint cand_id PK
        bigint cand_ele_id FK
        varchar cand_nome
        boolean cand_ativo
    }
    RONDA_CANDIDATO {
        bigint rc_ron_id PK,FK
        bigint rc_cand_id PK,FK
    }
    HABILITACAO {
        bigint hab_ele_id PK,FK
        bigint hab_ut_id PK,FK
    }
    PARTICIPACAO {
        bigint part_id PK
        bigint part_ron_id FK
        bigint part_ut_id FK
        timestamptz part_data
    }
    VOTO {
        uuid vot_id PK "aleatório = recibo"
        bigint vot_ron_id FK
        bigint vot_cand_id FK
        char vot_hash "HMAC-SHA256"
    }
    RESULTADO {
        bigint res_id PK
        bigint res_ron_id FK
        bigint res_cand_id FK
        int res_total_votos
        numeric res_percentagem
    }
    AUDITORIA {
        bigint aud_id PK
        bigint aud_ut_id FK
        varchar aud_acao
        jsonb aud_detalhes
        char aud_hash_anterior
        char aud_hash_atual
    }
```

> O diagrama usa Mermaid e é desenhado automaticamente no GitHub e no VS Code (com a extensão
> Markdown Preview Mermaid). O pgAdmin também desenha um diagrama: botão direito na BD
> `trustvote` → **ERD For Database**.

## Explicação das relações

**Utilizadores.** Há um único tipo de conta (`utilizador`), com o perfil `eleitor` ou
`administrador`. Os administradores criam eleições (`eleicao.ele_ut_id`); os eleitores são
habilitados para votar em eleições concretas (`habilitacao`).

**Eleição, rondas e candidatos.** Uma eleição tem os seus candidatos e 1 ou 2 rondas
(1.ª volta e, se necessário, 2.ª volta). A tabela `ronda_candidato` diz **quem concorre em cada
ronda**: na 1.ª volta são os candidatos ativos da eleição; na 2.ª, os dois mais votados.

**Votação — duas tabelas de propósito.** O voto está dividido para ser anónimo:

| Tabela | Guarda | Não guarda |
|---|---|---|
| `participacao` | **quem** votou em cada ronda (e quando) | em quem votou |
| `voto` | **em quem** se votou em cada ronda | quem votou, nem a hora |

Não existe nenhuma coluna que ligue uma linha de `participacao` a uma linha de `voto`.
O `UNIQUE (ronda, utilizador)` em `participacao` impede que alguém vote duas vezes na mesma ronda.

**Resultados.** Depois de uma ronda ser encerrada, o apuramento conta os votos e grava em
`resultado` uma linha por candidato da ronda (total e percentagem).

**Auditoria.** Cada operação relevante (login, criação de eleição, voto, apuramento…) gera uma
linha em `auditoria`, encadeada com a anterior por hashes (ver
[04_Seguranca_e_Integridade.md](04_Seguranca_e_Integridade.md)).

## Ciclo de vida dos dados de uma eleição

```
1. admin cria a eleição              -> eleicao (rascunho)
2. admin adiciona candidatos          -> candidato
3. admin define a ronda 1             -> ronda (agendada)
4. admin habilita eleitores           -> habilitacao
5. admin agenda                       -> eleicao (agendada) + ronda_candidato (candidatos da ronda 1)
6. admin inicia                       -> eleicao (em_curso) + ronda (aberta)
7. eleitores votam                    -> participacao + voto (na mesma transação)
8. fim do período (worker)            -> ronda (encerrada)
9. apuramento (worker)                -> resultado + ronda (apurada)
10. (se ninguém > 50%) 2.ª volta      -> nova ronda (numero = 2) com 2 candidatos -> passos 6 a 9
11. admin encerra                     -> eleicao (encerrada)
Em todos os passos                    -> auditoria
```
