"""Registo, login, JWT RS256 e permissões (RF01, RF02)."""
from datetime import datetime, timedelta, timezone

import jwt
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from sqlalchemy import select

from app.config import get_settings
from app.models import Auditoria, Utilizador

NOVO = {"nome": "Ana Silva", "email": "Ana@Teste.pt", "password": "Segredo123"}


def test_registo_cria_eleitor_com_password_em_argon2(client, db):
    r = client.post("/auth/registo", json=NOVO)
    assert r.status_code == 201, r.text
    corpo = r.json()
    assert corpo["perfil"] == "eleitor" and corpo["email"] == "ana@teste.pt"
    assert "password" not in str(corpo).lower()
    u = db.scalar(select(Utilizador).where(Utilizador.email == "ana@teste.pt"))
    assert u.password_hash.startswith("$argon2id$") and "Segredo123" not in u.password_hash


def test_registo_nao_permite_escolher_perfil_admin(client):
    r = client.post("/auth/registo", json={**NOVO, "perfil": "administrador"})
    assert r.status_code == 201 and r.json()["perfil"] == "eleitor"


def test_registo_email_duplicado_ignora_maiusculas(client):
    assert client.post("/auth/registo", json=NOVO).status_code == 201
    r = client.post("/auth/registo", json={**NOVO, "email": "ANA@teste.PT"})
    assert r.status_code == 409


def test_registo_rejeita_password_fraca_e_email_invalido(client):
    assert client.post("/auth/registo", json={**NOVO, "password": "curta1"}).status_code == 422
    assert client.post("/auth/registo", json={**NOVO, "password": "sonumerosnao"}).status_code == 422
    assert client.post("/auth/registo", json={**NOVO, "email": "nao-e-email"}).status_code == 422


def test_login_e_rota_protegida(client):
    client.post("/auth/registo", json=NOVO)
    r = client.post("/auth/login", json={"email": "ana@teste.pt", "password": "Segredo123"})
    assert r.status_code == 200
    token = r.json()["access_token"]
    assert r.json()["token_type"] == "bearer"
    assert jwt.get_unverified_header(token)["alg"] == "RS256"
    eu = client.get("/auth/eu", headers={"Authorization": f"Bearer {token}"})
    assert eu.status_code == 200 and eu.json()["email"] == "ana@teste.pt"


def test_login_falhado_tem_mensagem_igual_e_fica_auditado(client, db):
    client.post("/auth/registo", json=NOVO)
    errada = client.post("/auth/login", json={"email": "ana@teste.pt", "password": "Errada123"})
    inexistente = client.post("/auth/login", json={"email": "ninguem@teste.pt", "password": "Errada123"})
    assert errada.status_code == inexistente.status_code == 401
    assert errada.json() == inexistente.json()  # não revela se o email existe
    acoes = db.scalars(select(Auditoria.acao).where(Auditoria.acao == "auth.login_falhado")).all()
    assert len(acoes) == 2


def test_sem_token_ou_token_invalido(client):
    assert client.get("/auth/eu").status_code == 401
    assert client.get("/auth/eu", headers={"Authorization": "Bearer abc.def.ghi"}).status_code == 401


def test_token_assinado_com_outra_chave_e_rejeitado(client, criar_utilizador):
    u = criar_utilizador("x@teste.pt")
    outra = rsa.generate_private_key(public_exponent=65537, key_size=2048).private_bytes(
        serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption())
    agora = datetime.now(timezone.utc)
    falso = jwt.encode({"sub": str(u.id), "perfil": "administrador", "iss": "trustvote", "iat": agora,
                        "exp": agora + timedelta(minutes=5)}, outra, algorithm="RS256")
    assert client.get("/auth/eu", headers={"Authorization": f"Bearer {falso}"}).status_code == 401


def test_token_hs256_com_chave_publica_e_rejeitado(client, criar_utilizador):
    """Ataque clássico de confusão de algoritmo: assinar HS256 usando a chave pública como segredo."""
    import base64
    import hashlib
    import hmac
    import json

    def b64(dados: bytes) -> str:
        return base64.urlsafe_b64encode(dados).rstrip(b"=").decode()

    u = criar_utilizador("x@teste.pt")
    agora = int(datetime.now(timezone.utc).timestamp())
    payload = {"sub": str(u.id), "perfil": "administrador", "iss": "trustvote", "iat": agora, "exp": agora + 300}
    cabeca = b64(json.dumps({"alg": "HS256", "typ": "JWT"}).encode()) + "." + b64(json.dumps(payload).encode())
    assinatura = hmac.new(get_settings().jwt_public_key.encode(), cabeca.encode(), hashlib.sha256).digest()
    falso = cabeca + "." + b64(assinatura)
    assert client.get("/auth/eu", headers={"Authorization": f"Bearer {falso}"}).status_code == 401
    sem_assinatura = b64(json.dumps({"alg": "none", "typ": "JWT"}).encode()) + "." + b64(json.dumps(payload).encode()) + "."
    assert client.get("/auth/eu", headers={"Authorization": f"Bearer {sem_assinatura}"}).status_code == 401


def test_token_expirado_e_rejeitado(client, criar_utilizador):
    u = criar_utilizador("x@teste.pt")
    passado = datetime.now(timezone.utc) - timedelta(hours=2)
    expirado = jwt.encode({"sub": str(u.id), "iss": "trustvote", "iat": passado,
                           "exp": passado + timedelta(minutes=30)}, get_settings().jwt_private_key, algorithm="RS256")
    assert client.get("/auth/eu", headers={"Authorization": f"Bearer {expirado}"}).status_code == 401


def test_conta_desativada_perde_acesso_mesmo_com_token_valido(client, admin, eleitor):
    (_, h_admin), (u_eleitor, h_eleitor) = admin, eleitor
    assert client.get("/auth/eu", headers=h_eleitor).status_code == 200
    r = client.patch(f"/utilizadores/{u_eleitor.id}", json={"ativo": False}, headers=h_admin)
    assert r.status_code == 200 and r.json()["ativo"] is False
    assert client.get("/auth/eu", headers=h_eleitor).status_code == 401
    r = client.post("/auth/login", json={"email": "eleitor@teste.pt", "password": "Password123"})
    assert r.status_code == 401


def test_perfil_vem_da_bd_e_nao_do_token(client, admin, eleitor):
    """Um eleitor promovido a admin ganha o acesso logo, sem novo login (o perfil não é lido do token)."""
    (_, h_admin), (u_eleitor, h_eleitor) = admin, eleitor
    assert client.get("/utilizadores", headers=h_eleitor).status_code == 403
    client.patch(f"/utilizadores/{u_eleitor.id}", json={"perfil": "administrador"}, headers=h_admin)
    assert client.get("/utilizadores", headers=h_eleitor).status_code == 200


def test_gestao_de_utilizadores_so_para_admin(client, admin, eleitor):
    (u_admin, h_admin), (_, h_eleitor) = admin, eleitor
    lista = client.get("/utilizadores", headers=h_admin)
    assert lista.status_code == 200 and len(lista.json()) == 2
    assert client.get("/utilizadores?perfil=eleitor", headers=h_admin).json()[0]["perfil"] == "eleitor"
    assert client.patch(f"/utilizadores/{u_admin.id}", json={"ativo": False}, headers=h_eleitor).status_code == 403


def test_admin_nao_pode_retirar_o_proprio_acesso(client, admin):
    u_admin, h_admin = admin
    assert client.patch(f"/utilizadores/{u_admin.id}", json={"perfil": "eleitor"}, headers=h_admin).status_code == 403
    assert client.patch(f"/utilizadores/{u_admin.id}", json={"ativo": False}, headers=h_admin).status_code == 403
    assert client.patch("/utilizadores/999999", json={"ativo": False}, headers=h_admin).status_code == 404
