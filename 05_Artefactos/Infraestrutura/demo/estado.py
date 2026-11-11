"""Mostra no terminal o estado de cada nó, para acompanhar a demonstração.

    python Infraestrutura/demo/estado.py            mostra uma vez
    python Infraestrutura/demo/estado.py --seguir   atualiza a cada 2 segundos
"""

import json
import subprocess
import sys
import time
import urllib.request

API = "http://127.0.0.1:8080/api/health"
NOS = ("trustvote-db-primary", "trustvote-db-replica")
SERVICOS = ("trustvote-nginx", "trustvote-servidor1", "trustvote-servidor2", "trustvote-monitor")


def executar(*argumentos):
    resultado = subprocess.run(argumentos, capture_output=True, text=True, timeout=8)
    return resultado.stdout.strip() if resultado.returncode == 0 else ""


def estado_contentor(nome):
    return executar("docker", "inspect", "-f", "{{.State.Status}}", nome) or "inexistente"


def sql(no, consulta):
    return executar("docker", "exec", no, "psql", "-tA", "-U", "postgres", "-d", "trustvote", "-c", consulta)


def linha_no(no):
    estado = estado_contentor(no)
    if estado != "running":
        return f"  {no:24} {estado.upper()}"
    em_recuperacao = sql(no, "SELECT pg_is_in_recovery()")
    votos = sql(no, "SELECT count(*) FROM voto")
    if em_recuperacao == "f":
        replica = sql(no, "SELECT sync_state FROM pg_stat_replication") or "sem réplica"
        return f"  {no:24} PRIMÁRIO  votos={votos:<6} replicação={replica}"
    if em_recuperacao == "t":
        return f"  {no:24} RÉPLICA   votos={votos}"
    return f"  {no:24} a arrancar"


def instancia_que_respondeu():
    try:
        with urllib.request.urlopen(API, timeout=3) as resposta:
            return json.loads(resposta.read())
    except OSError as erro:
        return {"erro": str(erro)}


def mostrar():
    print(time.strftime("%H:%M:%S"), "· TrustVote")
    print("Bases de dados")
    for no in NOS:
        print(linha_no(no))
    print("Serviços")
    for servico in SERVICOS:
        print(f"  {servico:24} {estado_contentor(servico)}")
    print("API:", instancia_que_respondeu())


def main():
    if "--seguir" not in sys.argv:
        mostrar()
        return
    while True:
        print("\033[2J\033[H", end="")
        mostrar()
        time.sleep(2)


if __name__ == "__main__":
    main()
