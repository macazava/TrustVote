"""Provoca uma falha a meio de uma votação e confirma que nenhum voto se perde.

Uso, com a stack e os dados de demonstração a correr:

    python Infraestrutura/testes/teste_falhas.py <cenário> [eleitores]

Cenários:
    api-kill      mata uma instância da API
    api-pause     congela uma instância da API
    bd-kill       mata a base de dados primária
    bd-pause      congela a base de dados primária
    replica-kill  mata a réplica

Os eleitores repetem o voto em caso de erro, como faria uma pessoa. No fim, os votos
guardados têm de coincidir com os confirmados, nas duas bases de dados.
Cada execução cria uma eleição e contas de teste: limpem a BD antes da demonstração.
"""

import json
import os
import queue
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from collections import Counter
from datetime import datetime, timedelta, timezone

API = os.getenv("DEMO_API", "http://127.0.0.1:8080/api")
PASSWORD = os.getenv("DEMO_PASSWORD", "Demonstracao2026")
NOS = ("trustvote-db-primary", "trustvote-db-replica")
ERROS_TEMPORARIOS = (0, 502, 503, 504)
LIMITE_REPETICAO = 45
INICIO_DA_FALHA = 2.5


def pedido(metodo, rota, corpo=None, token=None, timeout=12):
    cabecalhos = {"Content-Type": "application/json"}
    if token:
        cabecalhos["Authorization"] = f"Bearer {token}"
    dados = None if corpo is None else json.dumps(corpo).encode()
    req = urllib.request.Request(API + rota, data=dados, headers=cabecalhos, method=metodo)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resposta:
            texto = resposta.read().decode()
            return resposta.status, json.loads(texto) if texto else None
    except urllib.error.HTTPError as erro:
        return erro.code, None
    except OSError:
        return 0, None


def docker(*argumentos):
    return subprocess.run(["docker", *argumentos], capture_output=True, text=True).stdout.strip()


def sql(no, consulta):
    return docker("exec", no, "psql", "-tA", "-U", "postgres", "-d", "trustvote", "-c", consulta)


def papeis():
    """Devolve (primário, réplica) tal como estão agora."""
    primario = next(no for no in NOS if sql(no, "SELECT pg_is_in_recovery()") == "f")
    return primario, next(no for no in NOS if no != primario)


def replica_sincrona(primario):
    return sql(primario, "SELECT sync_state FROM pg_stat_replication") == "sync"


def esperar(condicao, limite):
    fim = time.time() + limite
    while time.time() < fim:
        try:
            if condicao():
                return True
        except StopIteration:
            pass
        time.sleep(0.5)
    return False


def preparar(eleitores):
    token_equipa = pedido("POST", "/auth/login", {"email": "equipa@trustvote.pt", "password": PASSWORD})[1]["access_token"]
    agora = datetime.now(timezone.utc)
    prefixo = f"f{int(time.time()) % 100000}"
    eleicao = pedido("POST", "/eleicoes", {"titulo": f"Teste de falhas {prefixo}"}, token_equipa)[1]["id"]
    pedido(
        "POST",
        f"/eleicoes/{eleicao}/rondas",
        {
            "data_inicio": (agora - timedelta(minutes=2)).isoformat(),
            "data_fim": (agora + timedelta(hours=1)).isoformat(),
        },
        token_equipa,
    )
    candidatos = [pedido("POST", f"/eleicoes/{eleicao}/candidatos", {"nome": n}, token_equipa)[1]["id"] for n in "AB"]

    tokens = {}
    for i in range(eleitores):
        nome = f"{prefixo}x{i:04d}"
        estado = pedido(
            "POST",
            "/auth/register",
            {"nome_utilizador": nome, "email": f"{nome}@ex.pt", "num_estudante": nome, "password": PASSWORD},
        )[0]
        assert estado == 201, estado
        tokens[nome] = pedido("POST", "/auth/login", {"email": f"{nome}@ex.pt", "password": PASSWORD})[1]["access_token"]

    assert pedido("POST", f"/eleicoes/{eleicao}/agendar", token=token_equipa)[0] == 200
    assert pedido("POST", f"/eleicoes/{eleicao}/iniciar", token=token_equipa)[0] == 200
    return eleicao, candidatos, tokens


class Votacao:
    def __init__(self, eleicao, candidatos, tokens):
        self.rota = f"/eleicoes/{eleicao}/rondas/1/votos"
        self.candidatos = candidatos
        self.tokens = tokens
        self.fila = queue.Queue()
        for indice, nome in enumerate(tokens):
            self.fila.put((indice, nome))
        self.resultados = {}
        self.erros = []
        self.inicio = time.perf_counter()

    def votante(self):
        while True:
            try:
                indice, nome = self.fila.get_nowait()
            except queue.Empty:
                return
            corpo = {"candidato_id": self.candidatos[indice % 2]}
            limite = time.perf_counter() + LIMITE_REPETICAO
            tentativas = 0
            while True:
                estado, _ = pedido("POST", self.rota, corpo, self.tokens[nome])
                tentativas += 1
                if estado not in ERROS_TEMPORARIOS or time.perf_counter() > limite:
                    break
                self.erros.append((time.perf_counter() - self.inicio, estado))
                time.sleep(0.5)
            self.resultados[nome] = (estado, tentativas)
            time.sleep(0.15)

    def correr(self, provocar_falha):
        fios = [threading.Thread(target=self.votante) for _ in range(6)]
        for fio in fios:
            fio.start()
        time.sleep(INICIO_DA_FALHA)
        provocar_falha()
        momento = time.perf_counter() - self.inicio
        for fio in fios:
            fio.join()
        return momento


def recuperar(contentor, pausado):
    docker("unpause" if pausado else "start", contentor)


def main():
    cenario = sys.argv[1]
    eleitores = int(sys.argv[2]) if len(sys.argv) > 2 else 300
    primario, replica = papeis()
    if not replica_sincrona(primario):
        sys.exit("A réplica tem de estar síncrona antes do teste.")

    alvo = {
        "api-kill": "trustvote-servidor1",
        "api-pause": "trustvote-servidor1",
        "bd-kill": primario,
        "bd-pause": primario,
        "replica-kill": replica,
    }[cenario]
    pausado = cenario.endswith("pause")

    print(f"Primário: {primario} | a preparar {eleitores} eleitores...", flush=True)
    eleicao, candidatos, tokens = preparar(eleitores)
    ronda = sql(primario, f"SELECT ron_id FROM ronda WHERE ron_ele_id = {eleicao}")

    votacao = Votacao(eleicao, candidatos, tokens)
    momento = votacao.correr(lambda: docker("pause" if pausado else "kill", alvo))
    print(f"{cenario}: {alvo} falhou aos {momento:.1f} s")

    papeis_bd = cenario.startswith("bd")
    if papeis_bd:
        novo_primario = next(no for no in NOS if no != alvo)
        promovido = sql(novo_primario, "SELECT pg_is_in_recovery()") == "f"
        print("Réplica promovida:", promovido)
    else:
        novo_primario = primario

    finais = Counter(estado for estado, _ in votacao.resultados.values())
    repetiram = sum(1 for _, tentativas in votacao.resultados.values() if tentativas > 1)
    confirmados = finais[201]
    sem_recibo = sum(1 for estado, tentativas in votacao.resultados.values() if estado == 409 and tentativas > 1)
    print("Resultado final por eleitor:", dict(finais))
    print("Eleitores que repetiram:", repetiram, "| voto contado sem recibo:", sem_recibo)
    if votacao.erros:
        primeiro, ultimo = votacao.erros[0][0], votacao.erros[-1][0]
        print(f"Erros temporários: {len(votacao.erros)} entre {primeiro:.1f} s e {ultimo:.1f} s ({dict(Counter(e for _, e in votacao.erros))})")
        print(f"Tempo sem aceitar votos: {max(0.0, ultimo - momento):.1f} s")

    print("A recuperar o nó que falhou...", flush=True)
    recuperar(alvo, pausado)
    atual = novo_primario
    sincronizada = esperar(lambda: replica_sincrona(papeis()[0]), 120)
    if sincronizada:
        atual = papeis()[0]
    print("Réplica de novo síncrona:", sincronizada, "| primário atual:", atual)

    outro = next(no for no in NOS if no != atual)
    contagem = f"SELECT (SELECT count(*) FROM voto WHERE vot_ron_id = {ronda}), (SELECT count(*) FROM participacao WHERE part_ron_id = {ronda})"
    no_primario = sql(atual, contagem)
    time.sleep(1)
    na_replica = sql(outro, contagem)
    print("Votos|participações no primário:", no_primario, "| na réplica:", na_replica)

    votos, participacoes = map(int, no_primario.split("|"))
    aprovado = (
        votos == participacoes == confirmados + sem_recibo
        and confirmados + sem_recibo == eleitores
        and no_primario == na_replica
        and sincronizada
    )
    print("APROVADO" if aprovado else "REPROVADO")
    sys.exit(0 if aprovado else 1)


if __name__ == "__main__":
    main()
