"""TOTP (2FA): segredo cifrado com AES-GCM, códigos, proteção contra reutilização e fluxo completo."""
import time

import pyotp
import pytest
from cryptography.exceptions import InvalidTag
from sqlalchemy import select

from app.models import Utilizador
from app.security import totp


def test_segredo_cifrado_e_decifrado():
    segredo = totp.gerar_segredo()
    cifrado = totp.cifrar(segredo)
    assert segredo not in cifrado
    assert totp.cifrar(segredo) != cifrado  # nonce aleatório
    assert totp.decifrar(cifrado) == segredo


def test_segredo_cifrado_adulterado_e_detetado():
    import base64
    dados = bytearray(base64.b64decode(totp.cifrar(totp.gerar_segredo())))
    dados[-1] ^= 1
    with pytest.raises(InvalidTag):
        totp.decifrar(base64.b64encode(bytes(dados)).decode())


def test_verificar_codigo_e_reutilizacao():
    segredo = totp.gerar_segredo()
    agora = time.time()
    codigo = pyotp.TOTP(segredo).at(agora)
    passo = totp.verificar_codigo(segredo, codigo, None, agora=agora)
    assert passo == int(agora // 30)
    assert totp.verificar_codigo(segredo, codigo, passo, agora=agora) is None  # o mesmo código não serve 2 vezes
    assert totp.verificar_codigo(segredo, "000000" if codigo != "000000" else "111111", None, agora=agora) is None
    assert totp.verificar_codigo(segredo, "abc", None, agora=agora) is None
    antigo = pyotp.TOTP(segredo).at(agora - 120)
    assert totp.verificar_codigo(segredo, antigo, None, agora=agora) is None  # fora da janela


def test_fluxo_totp_completo(client, eleitor, db):
    u, h = eleitor
    cfg = client.post("/auth/totp/configurar", headers=h)
    assert cfg.status_code == 200
    segredo = cfg.json()["segredo"]
    assert cfg.json()["uri"].startswith("otpauth://totp/")

    # na BD o segredo está cifrado e o TOTP ainda não está ativo
    guardado = db.scalar(select(Utilizador).where(Utilizador.id == u.id))
    assert guardado.totp_segredo != segredo and guardado.totp_ativo is False

    gerador = pyotp.TOTP(segredo)
    assert client.post("/auth/totp/ativar", json={"codigo": "123456" if gerador.now() != "123456" else "654321"},
                       headers=h).status_code == 422
    assert client.post("/auth/totp/ativar", json={"codigo": gerador.now()}, headers=h).status_code == 204

    sem_codigo = client.post("/auth/login", json={"email": "eleitor@teste.pt", "password": "Password123"})
    assert sem_codigo.status_code == 401 and "TOTP" in sem_codigo.json()["detail"]

    # o código atual já foi usado na ativação: usa-se o do passo seguinte (aceite pela janela de ±30 s)
    proximo = gerador.at(time.time() + 30)
    ok = client.post("/auth/login", json={"email": "eleitor@teste.pt", "password": "Password123",
                                          "codigo_totp": proximo})
    assert ok.status_code == 200
    replay = client.post("/auth/login", json={"email": "eleitor@teste.pt", "password": "Password123",
                                              "codigo_totp": proximo})
    assert replay.status_code == 401  # reutilizar o mesmo código é recusado

    assert client.post("/auth/totp/configurar", headers=h).status_code == 409  # já ativo


def test_password_errada_nao_chega_a_pedir_totp(client, eleitor):
    _, h = eleitor
    segredo = client.post("/auth/totp/configurar", headers=h).json()["segredo"]
    client.post("/auth/totp/ativar", json={"codigo": pyotp.TOTP(segredo).now()}, headers=h)
    r = client.post("/auth/login", json={"email": "eleitor@teste.pt", "password": "Errada999"})
    assert r.status_code == 401 and "TOTP" not in r.json()["detail"]


def test_desativar_totp_exige_codigo(client, eleitor, db):
    u, h = eleitor
    segredo = client.post("/auth/totp/configurar", headers=h).json()["segredo"]
    gerador = pyotp.TOTP(segredo)
    client.post("/auth/totp/ativar", json={"codigo": gerador.now()}, headers=h)
    assert client.post("/auth/totp/desativar", json={"codigo": "000000"}, headers=h).status_code == 422
    assert client.post("/auth/totp/desativar", json={"codigo": gerador.at(time.time() + 30)},
                       headers=h).status_code == 204
    db.expire_all()
    guardado = db.get(Utilizador, u.id)
    assert guardado.totp_ativo is False and guardado.totp_segredo is None
