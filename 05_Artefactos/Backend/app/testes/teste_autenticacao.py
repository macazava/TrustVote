"""Registo, login, palavras-passe e lista oficial de inscritos."""

from app.services import estudante_inscrito
from app.testes.conftest import PASSWORD, cabecalho, entrar, registar


def teste_registo_login_e_eu(cliente):
    registar(cliente, "ana")
    token = entrar(cliente, "ana")
    eu = cliente.get("/auth/eu", headers=cabecalho(token)).json()
    assert eu["nome"] == "ana" and eu["perfil"] == "eleitor"


def teste_login_errado(cliente):
    registar(cliente, "ana")
    resposta = cliente.post("/auth/login", json={"email": "ana@ex.pt", "password": "errada123"})
    assert resposta.status_code == 401


def teste_sem_token(cliente):
    assert cliente.get("/auth/eu").status_code == 401


def teste_alterar_password(cliente):
    registar(cliente, "ana")
    h = cabecalho(entrar(cliente, "ana"))
    errada = cliente.post("/auth/password", json={"atual": "errada123", "nova": "nova-pass-9"}, headers=h)
    assert errada.status_code == 400
    assert cliente.post("/auth/password", json={"atual": PASSWORD, "nova": "nova-pass-9"}, headers=h).status_code == 204
    assert cliente.post("/auth/login", json={"email": "ana@ex.pt", "password": "nova-pass-9"}).status_code == 200


def teste_repor_password(cliente, admin):
    ana = registar(cliente, "ana")
    resposta = cliente.post(f"/utilizadores/{ana['id']}/repor-password", headers=cabecalho(admin))
    temporaria = resposta.json()["password_temporaria"]
    assert cliente.post("/auth/login", json={"email": "ana@ex.pt", "password": temporaria}).status_code == 200
    assert cliente.post("/auth/login", json={"email": "ana@ex.pt", "password": PASSWORD}).status_code == 401


def teste_eleitor_nao_acede_a_rotas_de_admin(cliente):
    registar(cliente, "ana")
    h = cabecalho(entrar(cliente, "ana"))
    assert cliente.get("/auditoria", headers=h).status_code == 403
    assert cliente.get("/utilizadores", headers=h).status_code == 403


def teste_registo_restrito(cliente, admin, monkeypatch):
    monkeypatch.setattr(estudante_inscrito, "REGISTO_RESTRITO", True)
    dados = {
        "nome_utilizador": "rui",
        "email": "rui@ex.pt",
        "num_estudante": "20260001",
        "curso": "Design",
        "password": PASSWORD,
    }
    assert cliente.post("/auth/register", json=dados).status_code == 403

    lote = {"estudantes": [{"num_estudante": "20260001", "nome": "Rui"}]}
    resposta = cliente.post("/estudantes-inscritos", json=lote, headers=cabecalho(admin))
    assert resposta.json() == {"adicionados": 1, "ja_existiam": 0}
    assert cliente.post("/auth/register", json=dados).status_code == 201

    lista = cliente.get("/estudantes-inscritos", headers=cabecalho(admin)).json()
    assert lista["restrito"] is True and lista["estudantes"][0]["registado"] is True
