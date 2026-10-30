"""Rotas e formatos que o frontend (05_Artefactos/Frontend/js/models/api.js) usa."""
from app.testes.teste_votacao import eleicao_em_curso


def test_voto_participacao_e_recibo(client, admin, eleitor):
    (_, h), (u, he) = admin, eleitor
    eid, (c1, *_) = eleicao_em_curso(client, h, [u.id])
    assert client.get(f"/eleicoes/{eid}/participacao", headers=he).json()["votou"] is False

    r = client.post(f"/eleicoes/{eid}/rondas/1/votos", json={"candidato_id": c1}, headers=he).json()
    assert len(r["hash"]) == 64 and r["data"] and r["ronda"] == 1
    p = client.get(f"/eleicoes/{eid}/participacao", headers=he).json()
    assert p["votou"] is True and p["ronda"] == 1

    v = client.get(f"/recibos/{r['recibo']}/verificar", headers=he).json()
    assert v["valido"] is True and v["incluido"] is True and v["ronda"] == 1
    assert client.get("/recibos/TV-NAOEXISTE/verificar", headers=he).json()["valido"] is False
    # não há lista de recibos no servidor (anonimato): o frontend usa os guardados no dispositivo
    assert client.get("/recibos", headers=he).status_code == 404


def test_resumo_publico_sem_login(client, admin, eleitor):
    (_, h), (u, he) = admin, eleitor
    vazio = client.get("/publico/resumo").json()
    assert vazio["eleicao"] is None and vazio["candidatos"] == []

    eid, (c1, *_) = eleicao_em_curso(client, h, [u.id])
    client.post(f"/eleicoes/{eid}/rondas/1/votos", json={"candidato_id": c1}, headers=he)
    r = client.get("/publico/resumo").json()
    assert r["eleicao"]["id"] == eid and r["eleicao"]["estado"] == "em_curso" and r["eleicao"]["data_fim"]
    assert r["eleitores"] == 1 and r["votos"] == 1 and r["participacao"] == 100.0
    assert len(r["candidatos"]) == 3 and "total_votos" not in r["candidatos"][0]


def test_sondagem(client, admin, eleitor):
    (_, h), (u, he) = admin, eleitor
    eid, (c1, c2, c3) = eleicao_em_curso(client, h, [u.id])
    s = client.get(f"/eleicoes/{eid}/sondagem", headers=he).json()
    assert s["amostra"] == 0 and s["intervalo"] is None and len(s["projecao"]) == 3

    assert client.post(f"/eleicoes/{eid}/sondagem/respostas", json={"candidato_id": c2},
                       headers=he).status_code == 201
    assert client.post(f"/eleicoes/{eid}/sondagem/respostas", json={"candidato_id": c2},
                       headers=he).status_code == 409  # só uma resposta
    s = client.get(f"/eleicoes/{eid}/sondagem", headers=he).json()
    assert s["amostra"] == 1 and s["projecao"][0]["candidato_id"] == c2 and s["projecao"][0]["percentagem"] == 50.0
    assert client.post(f"/eleicoes/{eid}/sondagem/respostas", json={"candidato_id": 999999},
                       headers=h).status_code == 422


def test_cors_para_o_frontend(client):
    r = client.options("/auth/login", headers={"Origin": "http://127.0.0.1:5500",
                                               "Access-Control-Request-Method": "POST",
                                               "Access-Control-Request-Headers": "content-type"})
    assert r.status_code == 200 and r.headers["access-control-allow-origin"] in ("*", "http://127.0.0.1:5500")
