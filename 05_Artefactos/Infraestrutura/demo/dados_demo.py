"""Cria os dados da demonstração através da API, com a stack já a correr.

Espera uma base de dados vazia. Só usa a biblioteca padrão do Python:

    python Infraestrutura/demo/dados_demo.py

Variáveis opcionais: DEMO_API (por omissão http://127.0.0.1:8080/api) e
DEMO_PASSWORD. Estas contas são públicas: servem apenas para demonstração.
"""

import json
import os
import subprocess
import sys
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone

API = os.getenv("DEMO_API", "http://127.0.0.1:8080/api")
PASSWORD = os.getenv("DEMO_PASSWORD", "Demonstracao2026")
ADMIN = "equipa@trustvote.pt"
TOTAL_ELEITORES = 20
DIAS_DE_VOTACAO = 21

CANDIDATOS = (
    ("Marta Oliveira", "Lista A", "Engenharia Informática", 3, "Salas de estudo abertas à noite"),
    ("Tiago Ramos", "Lista B", "Direito", 2, "Bolsas para material escolar"),
    ("Beatriz Lopes", "Lista C", "Psicologia", 4, "Apoio psicológico gratuito"),
)


def pedido(metodo, rota, corpo=None, token=None):
    cabecalhos = {"Content-Type": "application/json"}
    if token:
        cabecalhos["Authorization"] = f"Bearer {token}"
    dados = None if corpo is None else json.dumps(corpo).encode()
    req = urllib.request.Request(API + rota, data=dados, headers=cabecalhos, method=metodo)
    try:
        with urllib.request.urlopen(req, timeout=15) as resposta:
            texto = resposta.read().decode()
    except urllib.error.HTTPError as erro:
        sys.exit(f"{metodo} {rota} falhou com {erro.code}: {erro.read().decode()}")
    return json.loads(texto) if texto else None


def registar(nome, email, numero, curso):
    pedido(
        "POST",
        "/auth/register",
        {
            "nome_utilizador": nome,
            "email": email,
            "num_estudante": numero,
            "curso": curso,
            "password": PASSWORD,
        },
    )


def tornar_administrador(nome):
    consulta = f"UPDATE utilizador SET ut_perfil='administrador' WHERE ut_nome='{nome}'"
    subprocess.run(
        ["docker", "exec", "trustvote-db-primary", "psql", "-q", "-U", "trustvote", "-d", "trustvote", "-c", consulta],
        check=True,
    )


def main():
    registar("equipa.demo", ADMIN, "ADMIN0001", "Comissão Eleitoral")
    tornar_administrador("equipa.demo")
    token = pedido("POST", "/auth/login", {"email": ADMIN, "password": PASSWORD})["access_token"]

    agora = datetime.now(timezone.utc)
    eleicao = pedido(
        "POST",
        "/eleicoes",
        {"titulo": "Direção da Associação de Estudantes 2026", "descricao": "Eleição da Direção da AE."},
        token,
    )
    rota = f"/eleicoes/{eleicao['id']}"
    pedido(
        "POST",
        f"{rota}/rondas",
        {
            "data_inicio": (agora - timedelta(minutes=1)).isoformat(),
            "data_fim": (agora + timedelta(days=DIAS_DE_VOTACAO)).isoformat(),
        },
        token,
    )
    for nome, lista, curso, ano, descricao in CANDIDATOS:
        pedido(
            "POST",
            f"{rota}/candidatos",
            {"nome": nome, "partido": lista, "orgao": "direcao", "curso": curso, "ano": ano, "descricao": descricao},
            token,
        )

    # O registo habilita automaticamente nas eleições ainda não encerradas.
    for i in range(1, TOTAL_ELEITORES + 1):
        registar(f"eleitor{i:02d}", f"eleitor{i:02d}@trustvote.pt", f"a{20260000 + i}", "Engenharia Informática")

    pedido("POST", f"{rota}/agendar", token=token)
    pedido("POST", f"{rota}/iniciar", token=token)

    print("Dados criados: a eleição está aberta.")
    print(f"  Equipa:  {ADMIN}")
    print(f"  Eleitores: eleitor01@trustvote.pt a eleitor{TOTAL_ELEITORES:02d}@trustvote.pt")
    print(f"  Palavra-passe: {PASSWORD}")


if __name__ == "__main__":
    main()
