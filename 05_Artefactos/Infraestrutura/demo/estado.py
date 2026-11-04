"""Mostra no terminal o estado de cada nó, para acompanhar a demonstração.

    python Infraestrutura/demo/estado.py            mostra uma vez
    python Infraestrutura/demo/estado.py --seguir   atualiza a cada 2 segundos
"""

import json
import subprocess
import sys
import time
import urllib.request

NGINX = {
    "entrada (8080)": "http://127.0.0.1:8080/api/health",
    "Nginx 1 (8081)": "http://127.0.0.1:8081/api/health",
    "Nginx 2 (8082)": "http://127.0.0.1:8082/api/health",
}
NOS = ("trustvote-db-primary", "trustvote-db-replica")
REDIS = ("trustvote-redis", "trustvote-redis-replica")
SERVIDORES = {
    "Servidor 1": ("trustvote-nginx1", "trustvote-servidor1", "trustvote-worker", "trustvote-sentinel1"),
    "Servidor 2": ("trustvote-nginx2", "trustvote-servidor2", "trustvote-worker-reserva", "trustvote-sentinel2"),
    "Árbitro": ("trustvote-entrada", "trustvote-monitor", "trustvote-sentinel3"),
}
WORKERS = ("trustvote-worker", "trustvote-worker-reserva")


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
        return f"  {no:26} {estado.upper()}"
    em_recuperacao = sql(no, "SELECT pg_is_in_recovery()")
    votos = sql(no, "SELECT count(*) FROM voto")
    if em_recuperacao == "f":
        replica = sql(no, "SELECT sync_state FROM pg_stat_replication") or "sem réplica"
        return f"  {no:26} PRIMÁRIO  votos={votos:<6} replicação={replica}"
    if em_recuperacao == "t":
        return f"  {no:26} RÉPLICA   votos={votos}"
    return f"  {no:26} a arrancar"


def linha_redis(nome):
    if estado_contentor(nome) != "running":
        return f"  {nome:26} {estado_contentor(nome).upper()}"
    info = executar("docker", "exec", nome, "sh", "-c", "redis-cli --no-auth-warning info replication")
    campos = dict(linha.split(":", 1) for linha in info.splitlines() if ":" in linha)
    if campos.get("role") == "master":
        return f"  {nome:26} PRINCIPAL réplicas={campos.get('connected_slaves', '0').strip()}"
    if campos.get("role") == "slave":
        return f"  {nome:26} RÉPLICA   ligação={campos.get('master_link_status', '?').strip()}"
    return f"  {nome:26} a arrancar"


def papel_worker(nome):
    if estado_contentor(nome) != "running":
        return ""
    papel = executar("docker", "exec", nome, "cat", "/tmp/worker-estado").split()
    return {"lider": "A APURAR", "reserva": "de reserva", "sem-bd": "sem BD"}.get(papel[0], "") if papel else ""


def instancia_que_respondeu(url):
    try:
        with urllib.request.urlopen(url, timeout=3) as resposta:
            return json.loads(resposta.read()).get("instance")
    except (OSError, ValueError) as erro:
        return f"erro: {erro}"


def mostrar():
    print(time.strftime("%H:%M:%S"), "· TrustVote")
    print("Bases de dados")
    for no in NOS:
        print(linha_no(no))
    print("Redis (os Sentinels promovem a réplica se o principal cair)")
    for nome in REDIS:
        print(linha_redis(nome))
    for grupo, contentores in SERVIDORES.items():
        print(grupo)
        for nome in contentores:
            extra = papel_worker(nome) if nome in WORKERS else ""
            print(f"  {nome:26} {estado_contentor(nome):10} {extra}")
    for nome, url in NGINX.items():
        print(f"API pelo {nome}:", instancia_que_respondeu(url))


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
