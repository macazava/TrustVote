# 4. Segurança e Integridade

## 4.1 Utilizadores da base de dados

| Utilizador | Para quê | Permissões |
|---|---|---|
| `postgres` | administração e criação inicial da BD | superutilizador |
| `trustvote` | a API (as duas instâncias e o worker) | **dono** da BD `trustvote` e das tabelas; não é superutilizador |
| `replicator` | replicação primário → réplica | só `REPLICATION`; aceite apenas a partir da rede Docker (`pg_hba`: `samenet`) |

As passwords vêm do ficheiro `.env` da infraestrutura (`POSTGRES_PASSWORD`, `TRUSTVOTE_DB_PASSWORD`,
`REPLICATION_PASSWORD`), que não vai para o Git. A autenticação usa `scram-sha-256`.

## 4.2 Acesso pela rede

- A BD **não está publicada** fora do Docker: só a API e o worker lhe chegam, pela rede interna
  `trustvote-network`.
- Em desenvolvimento, o `compose.debug.yaml` publica-a **só no próprio PC** (`127.0.0.1:15432` primário,
  `127.0.0.1:15433` réplica), para o pgAdmin e os testes.

## 4.3 Dados sensíveis

| Dado | Como é guardado |
|---|---|
| Passwords | hash **Argon2id** (`ut_password_hash`); a password nunca é guardada |
| Segredo TOTP (2FA) | **cifrado com AES-256-GCM** (`ut_totp_segredo`); a chave fica fora da BD (`secrets/totp_key.txt`). Uma cópia da BD sem a chave não permite gerar códigos |
| Códigos de reposição de password | não estão na BD: ficam no Redis, só o hash, e expiram em 30 min |

## 4.4 Anonimato do voto

| | `participacao` | `voto` |
|---|---|---|
| Quem votou | ✔ | ✘ |
| Em quem | ✘ | ✔ |
| Quando | ✔ | ✘ |
| Identificador | sequencial | **UUID aleatório** |

- Não há nenhuma coluna que ligue as duas tabelas.
- A auditoria regista *que* um eleitor votou (`voto.registado`), **nunca o candidato**.
- A API nunca devolve o candidato de um voto: o recibo só confirma que o voto existe e está íntegro.
- **Limitação:** quem tiver acesso direto ao PostgreSQL poderia, em teoria, tentar relacionar a ordem
  física das linhas das duas tabelas. A API não expõe essa informação.

## 4.5 Integridade dos votos

`vot_hash = HMAC-SHA256(chave, "vot_id|ronda|candidato")`

A chave é derivada (HKDF) da chave TOTP e **não está na BD**. Se alguém alterar o candidato de um voto
diretamente na BD, não consegue recalcular um hash válido:
- o **apuramento** deteta o voto alterado, não o conta e reporta-o (`votos_invalidos`);
- o **recibo** do eleitor (`GET /votos/{recibo}`) passa a indicar `integro: false`.

O apuramento confirma também que **nº de votos = nº de participações** (`consistente`).

## 4.6 Integridade da auditoria (cadeia de hashes)

```
registo 1: hash_atual = SHA256(NULL      + conteúdo 1)
registo 2: hash_atual = SHA256(hash 1    + conteúdo 2)
registo 3: hash_atual = SHA256(hash 2    + conteúdo 3)
```

Alterar ou apagar um registo antigo quebra todos os seguintes. `GET /auditoria/verificar` recalcula
a cadeia e indica o primeiro registo inválido. Registos antigos sem hash no início da tabela (de antes
desta funcionalidade) são contados à parte (`sem_encadeamento`).

**Limitação:** quem tiver acesso de escrita à BD **e** reescrever toda a cadeia a partir de um ponto
consegue torná-la novamente coerente; a cadeia protege contra alterações pontuais. Uma proteção
completa exigiria guardar periodicamente o último hash fora da BD.
