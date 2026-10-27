# Base de Dados — TrustVote

Documentação técnica da base de dados do TrustVote (PostgreSQL 16).

## Conteúdo desta pasta

| Ficheiro | O que contém |
|---|---|
| [01_Modelo_de_Dados.md](01_Modelo_de_Dados.md) | Diagrama entidade-relação e explicação das relações |
| [02_Dicionario_de_Dados.md](02_Dicionario_de_Dados.md) | Todas as tabelas e colunas: tipo, obrigatoriedade, valor por omissão e significado |
| [03_Regras_e_Restricoes.md](03_Regras_e_Restricoes.md) | Chaves primárias e estrangeiras, unicidade, CHECK, estados e índices |
| [04_Seguranca_e_Integridade.md](04_Seguranca_e_Integridade.md) | Anonimato do voto, hashes, cifra, utilizadores da BD e permissões |
| [05_Replicacao_e_Backups.md](05_Replicacao_e_Backups.md) | Réplica, promoção em caso de falha e cópias de segurança |
| [06_Guia_de_Utilizacao.md](06_Guia_de_Utilizacao.md) | Como aceder (pgAdmin, psql), recriar a BD e alterar o esquema |
| [sql/esquema_completo.sql](sql/esquema_completo.sql) | Cópia de referência do esquema, gerada com `pg_dump` a partir da BD |
| [sql/consultas_uteis.sql](sql/consultas_uteis.sql) | Consultas prontas a usar (estado das eleições, participação, resultados, auditoria) |

## Resumo

| | |
|---|---|
| SGBD | PostgreSQL 16, em Docker (`postgres:16`) |
| Base de dados | `trustvote` |
| Dono das tabelas | utilizador `trustvote` (o mesmo que a API usa) |
| Tabelas | 10 |
| Nós | `db-primary` (leitura e escrita) + `db-replica` (só leitura, replicação em streaming) |
| Acesso | só dentro da rede Docker; em desenvolvimento, `127.0.0.1:15432` (primário) e `15433` (réplica) |

As 10 tabelas, por área:

| Área | Tabelas | Requisitos |
|---|---|---|
| Utilizadores e acesso | `utilizador` | RF01, RF02 |
| Gestão eleitoral | `eleicao`, `ronda`, `candidato`, `ronda_candidato`, `habilitacao` | RF03, RF04, RF05 |
| Votação | `participacao`, `voto` | RF06, RF07, RF08 |
| Resultados | `resultado` | RF09, RF10 |
| Auditoria | `auditoria` | RF11 |

## Onde está o esquema "a sério"

Os scripts que **criam** a base de dados estão no backend, e é aí que se fazem alterações:

```
05_Artefactos/Backend/config/database/init/docker_sql_and_sh/
├── 00-trustvote-user.sql   cria o utilizador trustvote e torna-o dono da BD
└── trustvote.sql           cria as 10 tabelas, restrições e índices
```

O Docker executa-os automaticamente na primeira vez que a BD arranca (volume vazio). Os testes
automáticos do backend também os usam. O ficheiro `sql/esquema_completo.sql` desta pasta é apenas
uma cópia para consulta.
