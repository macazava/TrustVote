"""Auditoria (RF11): consulta pelo admin e deteção de adulterações pela cadeia de hashes."""
from sqlalchemy import text


def _gerar_atividade(client, h):
    eid = client.post("/eleicoes", json={"titulo": "Eleição auditada"}, headers=h).json()["id"]
    client.post(f"/eleicoes/{eid}/candidatos", json={"nome": "Candidato A"}, headers=h)
    client.post("/auth/login", json={"email": "admin@teste.pt", "password": "Errada999"})
    return eid


def test_consulta_e_filtros(client, admin, eleitor):
    (u_admin, h), (_, he) = admin, eleitor
    eid = _gerar_atividade(client, h)
    regs = client.get("/auditoria", headers=h).json()
    assert regs[0]["id"] > regs[-1]["id"]  # mais recentes primeiro
    assert all(len(r["hash_atual"]) == 64 for r in regs)
    auth = client.get("/auditoria?acao=auth.*", headers=h).json()
    assert auth and all(r["acao"].startswith("auth.") for r in auth)
    da_eleicao = client.get(f"/auditoria?entidade=eleicao&entidade_id={eid}", headers=h).json()
    assert {r["acao"] for r in da_eleicao} == {"eleicao.criada", "candidato.criado"}
    pagina = client.get(f"/auditoria?limite=2&antes_de={regs[0]['id']}", headers=h).json()
    assert len(pagina) == 2 and all(r["id"] < regs[0]["id"] for r in pagina)
    assert client.get("/auditoria", headers=he).status_code == 403


def test_cadeia_integra_e_adulteracao_detetada(client, admin, db):
    _, h = admin
    _gerar_atividade(client, h)
    ok = client.get("/auditoria/verificar", headers=h).json()
    assert ok["integra"] is True and ok["total"] >= 4

    # alguém com acesso à BD apaga o rasto de um login falhado
    alvo = db.execute(text("SELECT aud_id FROM auditoria WHERE aud_acao = 'auth.login_falhado'")).scalar()
    db.execute(text("UPDATE auditoria SET aud_detalhes = '{\"motivo\": \"nada\"}' WHERE aud_id = :i"), {"i": alvo})
    db.commit()
    r = client.get("/auditoria/verificar", headers=h).json()
    assert r["integra"] is False and r["primeiro_registo_invalido"] == alvo


def test_registos_antigos_sem_hash_no_inicio(client, db, criar_utilizador, login):
    """BDs criadas antes do encadeamento têm registos sem hash no início: contam à parte e a
    cadeia começa a seguir. Tirar o hash a um registo a meio continua a ser detetado."""
    # registo "antigo", gravado antes de existir o encadeamento (sem hashes)
    db.execute(text("INSERT INTO auditoria (aud_acao) VALUES ('utilizador.registo')"))
    db.commit()
    criar_utilizador("admin@teste.pt", perfil="administrador", nome="Admin")
    h = login("admin@teste.pt")
    _gerar_atividade(client, h)
    r = client.get("/auditoria/verificar", headers=h).json()
    assert r["integra"] is True and r["sem_encadeamento"] == 1

    ultimo = db.execute(text("SELECT max(aud_id) FROM auditoria")).scalar()
    db.execute(text("UPDATE auditoria SET aud_hash_atual = NULL, aud_hash_anterior = NULL WHERE aud_id = :i"),
               {"i": ultimo})
    db.commit()
    r = client.get("/auditoria/verificar", headers=h).json()
    assert r["integra"] is False and r["primeiro_registo_invalido"] == ultimo


def test_apagar_um_registo_quebra_a_cadeia(client, admin, db):
    _, h = admin
    _gerar_atividade(client, h)
    meio = db.execute(text("SELECT aud_id FROM auditoria ORDER BY aud_id OFFSET 1 LIMIT 1")).scalar()
    db.execute(text("DELETE FROM auditoria WHERE aud_id = :i"), {"i": meio})
    db.commit()
    r = client.get("/auditoria/verificar", headers=h).json()
    assert r["integra"] is False and r["primeiro_registo_invalido"] > meio
