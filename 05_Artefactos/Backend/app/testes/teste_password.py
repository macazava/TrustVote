"""Limite de tentativas de login, logout, alteração e reposição de password (Redis partilhado)."""
import time

import pyotp

PASSWORD = "Password123"  # a mesma das fixtures do conftest


def _login(client, email, password=PASSWORD, **extra):
    return client.post("/auth/login", json={"email": email, "password": password, **extra})


def test_bloqueio_apos_tentativas_falhadas(client, eleitor):
    for _ in range(5):
        assert _login(client, "eleitor@teste.pt", "Errada999").status_code == 401
    r = _login(client, "eleitor@teste.pt")  # password certa, mas o email está bloqueado
    assert r.status_code == 429 and "tentativas" in r.json()["detail"]
    assert _login(client, "admin@teste.pt", "x").status_code == 401  # outros emails não são afetados


def test_login_com_sucesso_limpa_as_falhas(client, eleitor):
    for _ in range(4):
        _login(client, "eleitor@teste.pt", "Errada999")
    assert _login(client, "eleitor@teste.pt").status_code == 200
    for _ in range(4):
        _login(client, "eleitor@teste.pt", "Errada999")
    assert _login(client, "eleitor@teste.pt").status_code == 200


def test_logout_invalida_so_esse_token(client, eleitor, login):
    _, h1 = eleitor
    h2 = login("eleitor@teste.pt")
    assert client.post("/auth/logout", headers=h1).status_code == 204
    assert client.get("/auth/eu", headers=h1).status_code == 401
    assert client.get("/auth/eu", headers=h2).status_code == 200  # outra sessão continua


def test_alterar_password_termina_todas_as_sessoes(client, eleitor, login):
    _, h1 = eleitor
    h2 = login("eleitor@teste.pt")
    errada = client.post("/auth/password/alterar", json={"password_atual": "Errada999",
                                                         "nova_password": "NovaPass123"}, headers=h1)
    assert errada.status_code == 401
    fraca = client.post("/auth/password/alterar", json={"password_atual": PASSWORD, "nova_password": "curta"},
                        headers=h1)
    assert fraca.status_code == 422
    ok = client.post("/auth/password/alterar", json={"password_atual": PASSWORD, "nova_password": "NovaPass123"},
                     headers=h1)
    assert ok.status_code == 204
    assert client.get("/auth/eu", headers=h1).status_code == 401
    assert client.get("/auth/eu", headers=h2).status_code == 401
    assert _login(client, "eleitor@teste.pt").status_code == 401
    novo = login("eleitor@teste.pt", "NovaPass123")
    assert client.get("/auth/eu", headers=novo).status_code == 200


def test_reposicao_com_codigo_do_admin(client, admin, eleitor, login):
    (_, h), (u, he) = admin, eleitor
    assert client.post(f"/utilizadores/{u.id}/codigo-reset", headers=he).status_code == 403
    r = client.post(f"/utilizadores/{u.id}/codigo-reset", headers=h)
    assert r.status_code == 200 and r.json()["expira_em_minutos"] == 30
    codigo = r.json()["codigo"]
    pedido = {"email": "eleitor@teste.pt", "nova_password": "Reposta123"}
    assert client.post("/auth/password/redefinir", json={**pedido, "codigo_reset": "ERRADO1234"}).status_code == 401
    assert client.post("/auth/password/redefinir", json={**pedido, "codigo_reset": codigo.lower()}).status_code == 204
    assert client.post("/auth/password/redefinir", json={**pedido, "codigo_reset": codigo}).status_code == 401  # uso único
    assert client.get("/auth/eu", headers=he).status_code == 401  # sessão antiga terminada
    assert login("eleitor@teste.pt", "Reposta123")
    assert client.post("/auth/password/redefinir",
                       json={"email": "ninguem@teste.pt", "nova_password": "Reposta123",
                             "codigo_reset": codigo}).status_code == 401


def test_reposicao_com_totp(client, eleitor, login):
    _, he = eleitor
    segredo = client.post("/auth/totp/configurar", headers=he).json()["segredo"]
    gerador = pyotp.TOTP(segredo)
    client.post("/auth/totp/ativar", json={"codigo": gerador.now()}, headers=he)
    r = client.post("/auth/password/redefinir", json={"email": "eleitor@teste.pt", "nova_password": "PorTotp123",
                                                      "codigo_totp": gerador.at(time.time() + 30)})
    assert r.status_code == 204
    proximo = gerador.at(time.time() + 30)  # já usado: tem de falhar (anti-replay)
    assert client.post("/auth/password/redefinir", json={"email": "eleitor@teste.pt", "nova_password": "Outra12345",
                                                         "codigo_totp": proximo}).status_code == 401
