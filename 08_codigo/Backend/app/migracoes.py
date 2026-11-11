"""Migrações da base de dados: alterações ao esquema depois da criação inicial.

A base de dados é criada pelo `config/database/init/docker_sql_and_sh/trustvote.sql` (só quando o volume está vazio).
Cada alteração seguinte é um ficheiro em `basedados/migracoes/`, com o nome
`NNN_descricao.sql` (ex.: `002_indice_auditoria.sql`), e nunca se edita depois de aplicado.

    python -m app.migracoes        (no Docker corre sozinho: cada instância da API aplica-as ao arrancar)

Aplica por ordem as que faltam, cada uma numa transação: se falhar, nada fica a meio e
o comando termina com erro (a API não arranca com o esquema errado). As aplicadas ficam
na tabela `schema_migracao`, com um resumo (SHA-256) do conteúdo: se alguém editar uma
migração já aplicada, isso é detetado. Um lock na BD impede duas execuções ao mesmo tempo.
"""

import hashlib
import logging
import re
import sys
import time
from pathlib import Path

from sqlalchemy.exc import OperationalError

log = logging.getLogger("trustvote.migracoes")

PASTA = Path(__file__).resolve().parents[1] / "basedados" / "migracoes"
NOME = re.compile(r"^(\d{3})_[a-z0-9_]+\.sql$")
CHAVE_LOCK = 7_240_020

CRIAR_TABELA = """
CREATE TABLE IF NOT EXISTS schema_migracao (
    smi_versao INTEGER PRIMARY KEY,
    smi_nome VARCHAR(200) NOT NULL,
    smi_resumo CHAR(64) NOT NULL,
    smi_aplicada_em TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
)
"""


class MigracaoError(Exception):
    """Migração inválida, alterada depois de aplicada, ou que falhou."""


def migracoes(pasta: Path = PASTA) -> list[tuple[int, str, str, str]]:
    """(versão, nome, SQL, resumo) de cada ficheiro, por ordem de versão."""
    lista, versoes = [], {}
    for ficheiro in sorted(pasta.glob("*.sql")) if pasta.exists() else []:
        m = NOME.match(ficheiro.name)
        if not m:
            raise MigracaoError(f"Nome inválido: {ficheiro.name} (use NNN_descricao.sql, em minúsculas)")
        versao = int(m.group(1))
        if versao in versoes:
            raise MigracaoError(f"Versão {versao} repetida: {versoes[versao]} e {ficheiro.name}")
        versoes[versao] = ficheiro.name
        sql = ficheiro.read_text(encoding="utf-8")
        lista.append((versao, ficheiro.name, sql, hashlib.sha256(sql.encode()).hexdigest()))
    return sorted(lista)


def aplicar(engine, pasta: Path = PASTA, chave: int = CHAVE_LOCK) -> list[str]:
    """Aplica as migrações em falta; devolve os nomes das que aplicou agora."""
    pendentes = migracoes(pasta)
    conexao = engine.raw_connection()
    aplicadas_agora = []
    try:
        cursor = conexao.cursor()
        cursor.execute("SELECT pg_advisory_lock(%s)", (chave,))
        cursor.execute(CRIAR_TABELA)
        conexao.commit()
        cursor.execute("SELECT smi_versao, smi_nome, smi_resumo FROM schema_migracao")
        feitas = {versao: (nome, resumo) for versao, nome, resumo in cursor.fetchall()}

        for versao, nome, sql, resumo in pendentes:
            if versao in feitas:
                if feitas[versao][1] != resumo:
                    raise MigracaoError(
                        f"{nome} foi alterada depois de aplicada. Não se editam migrações "
                        "aplicadas: crie uma nova com o número seguinte."
                    )
                continue
            try:
                cursor.execute(sql)
                cursor.execute(
                    "INSERT INTO schema_migracao (smi_versao, smi_nome, smi_resumo) VALUES (%s, %s, %s)",
                    (versao, nome, resumo),
                )
                conexao.commit()
            except Exception as erro:
                conexao.rollback()
                raise MigracaoError(f"{nome} falhou e não foi aplicada: {erro}") from erro
            aplicadas_agora.append(nome)
            log.info("Migração aplicada: %s", nome)
        return aplicadas_agora
    finally:
        try:
            conexao.rollback()
            conexao.cursor().execute("SELECT pg_advisory_unlock(%s)", (chave,))
            conexao.commit()
        finally:
            conexao.close()


def main() -> int:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    from app.database import engine_sem_pool  # só aqui: os testes passam o seu próprio engine

    # Espera pela BD que aceita escritas (no arranque, ou durante um failover)
    for tentativa in range(60):
        try:
            novas = aplicar(engine_sem_pool)
            break
        except OperationalError as erro:
            if tentativa == 59:
                log.error("Sem base de dados que aceite escritas: %s", erro.orig)
                return 1
            time.sleep(2)
        except MigracaoError as erro:
            log.error("%s", erro)
            return 1
    total = len(migracoes())
    log.info("Migrações: %d aplicada(s) agora, %d no total, esquema atualizado.", len(novas), total)
    return 0


if __name__ == "__main__":
    sys.exit(main())
