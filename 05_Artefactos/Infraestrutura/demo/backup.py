"""Faz uma cópia lógica da BD a partir do primário e confirma que ela restaura.

    python Infraestrutura/demo/backup.py

A replicação copia também os erros, por isso não substitui estas cópias.
Os ficheiros ficam em Infraestrutura/backups, que o git ignora.
"""

import gzip
import subprocess
import sys
import time
from pathlib import Path

NOS = ("trustvote-db-primary", "trustvote-db-replica")
PASTA = Path(__file__).resolve().parent.parent / "backups"
BD_TESTE = "trustvote_restauro"


def executar(*argumentos, entrada=None):
    resultado = subprocess.run(argumentos, capture_output=True, input=entrada)
    if resultado.returncode != 0:
        sys.exit(resultado.stderr.decode(errors="replace"))
    return resultado.stdout


def sql(no, base, consulta):
    return executar("docker", "exec", no, "psql", "-tA", "-U", "postgres", "-d", base, "-c", consulta).decode().strip()


def primario():
    for no in NOS:
        try:
            if sql(no, "postgres", "SELECT pg_is_in_recovery()") == "f":
                return no
        except SystemExit:
            continue
    sys.exit("Não há nenhum primário ativo.")


def contar_votos(no, base):
    return sql(no, base, "SELECT count(*) FROM voto")


def main():
    no = primario()
    copia = executar("docker", "exec", no, "pg_dump", "-U", "postgres", "--no-owner", "trustvote")
    PASTA.mkdir(exist_ok=True)
    ficheiro = PASTA / f"trustvote-{time.strftime('%Y%m%d-%H%M%S')}.sql.gz"
    ficheiro.write_bytes(gzip.compress(copia))

    # Confirma a cópia numa base de dados temporária, sem tocar nos dados reais.
    sql(no, "postgres", f"DROP DATABASE IF EXISTS {BD_TESTE}")
    sql(no, "postgres", f"CREATE DATABASE {BD_TESTE}")
    try:
        executar("docker", "exec", "-i", no, "psql", "-q", "-U", "postgres", "-d", BD_TESTE, entrada=copia)
        restaurados = contar_votos(no, BD_TESTE)
    finally:
        sql(no, "postgres", f"DROP DATABASE IF EXISTS {BD_TESTE}")

    votos = contar_votos(no, "trustvote")
    print(f"Cópia: {ficheiro} ({ficheiro.stat().st_size // 1024} KB)")
    print(f"Votos na BD: {votos} | votos restaurados: {restaurados}")
    if votos != restaurados:
        sys.exit("A cópia não coincide com a base de dados.")


if __name__ == "__main__":
    main()
