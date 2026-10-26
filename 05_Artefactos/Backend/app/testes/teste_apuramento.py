"""Apuramento e resultados (RF09, RF10), integridade dos votos e worker automático."""
from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.testes.teste_votacao import eleicao_em_curso


def _eleitores(criar_utilizador, login, n):
    us = [criar_utilizador(f"e{i}@teste.pt", nome=f"Eleitor {i}") for i in range(n)]
    return us, [login(u.email) for u in us]


def _votar(client, eid, ronda, headers, candidatos):
    for h, c in zip(headers, candidatos):
        assert client.post(f"/eleicoes/{eid}/rondas/{ronda}/votos", json={"candidato_id": c},
                           headers=h).status_code == 201


def test_vencedor_na_primeira_volta(client, admin, criar_utilizador, login):
    _, h = admin
    us, hs = _eleitores(criar_utilizador, login, 3)
    eid, (a, b, c) = eleicao_em_curso(client, h, [u.id for u in us])
    _votar(client, eid, 1, hs, [a, a, b])

    # antes de apurar não há contagens visíveis
    r = client.get(f"/eleicoes/{eid}/resultados", headers=hs[0]).json()
    assert r["rondas"][0]["apurada"] is False and r["rondas"][0]["candidatos"] is None
    assert client.post(f"/eleicoes/{eid}/rondas/1/apurar", headers=h).status_code == 409  # ainda aberta

    client.post(f"/eleicoes/{eid}/rondas/1/encerrar", headers=h)
    ap = client.post(f"/eleicoes/{eid}/rondas/1/apurar", headers=h).json()
    assert ap["votos_validos"] == 3 and ap["votos_invalidos"] == 0 and ap["consistente"] is True
    assert client.post(f"/eleicoes/{eid}/rondas/1/apurar", headers=h).status_code == 409  # já apurada

    r = client.get(f"/eleicoes/{eid}/resultados", headers=hs[0]).json()["rondas"][0]
    assert r["apurada"] and r["total_votos"] == 3
    assert [(x["candidato_id"], x["votos"], x["percentagem"]) for x in r["candidatos"]] == \
        [(a, 2, "66.67"), (b, 1, "33.33"), (c, 0, "0.00")]
    assert r["decisao"] == {"tipo": "vencedor", "candidatos": [a]}


def test_segunda_volta_e_vencedor_final(client, admin, criar_utilizador, login):
    _, h = admin
    us, hs = _eleitores(criar_utilizador, login, 5)
    eid, (a, b, c) = eleicao_em_curso(client, h, [u.id for u in us])
    _votar(client, eid, 1, hs, [a, a, b, b, c])
    client.post(f"/eleicoes/{eid}/rondas/1/encerrar", headers=h)
    client.post(f"/eleicoes/{eid}/rondas/1/apurar", headers=h)
    decisao = client.get(f"/eleicoes/{eid}/resultados", headers=h).json()["rondas"][0]["decisao"]
    assert decisao == {"tipo": "segunda_volta", "candidatos": [a, b]}  # ninguém passou dos 50%

    agora = datetime.now(timezone.utc)
    # a 2.ª volta tem de começar depois do fim da ronda 1 (fim = agora + 1h na fixture)
    r2 = {"data_inicio": (agora + timedelta(hours=2)).isoformat(),
          "data_fim": (agora + timedelta(hours=5)).isoformat(), "candidato_ids": decisao["candidatos"]}
    assert client.post(f"/eleicoes/{eid}/rondas", json=r2, headers=h).status_code == 201
    client.post(f"/eleicoes/{eid}/rondas/2/abrir", headers=h)
    from app.database import get_session_factory
    from app.services import votacao
    with get_session_factory()() as s:  # vota "dentro" do período da 2.ª volta
        for u, cand in zip(us, [b, b, b, a, a]):
            votacao.votar(s, s.merge(u), eid, 2, cand, agora=agora + timedelta(hours=3))
    client.post(f"/eleicoes/{eid}/rondas/2/encerrar", headers=h)
    client.post(f"/eleicoes/{eid}/rondas/2/apurar", headers=h)
    r = client.get(f"/eleicoes/{eid}/resultados", headers=hs[0]).json()["rondas"][1]
    assert r["decisao"] == {"tipo": "vencedor", "candidatos": [b]} and r["total_votos"] == 5


def test_empate_e_sem_votos(client, admin, criar_utilizador, login):
    _, h = admin
    us, hs = _eleitores(criar_utilizador, login, 2)
    eid, (a, b) = eleicao_em_curso(client, h, [u.id for u in us], n_candidatos=2)
    client.post(f"/eleicoes/{eid}/rondas/1/encerrar", headers=h)
    client.post(f"/eleicoes/{eid}/rondas/1/apurar", headers=h)
    r = client.get(f"/eleicoes/{eid}/resultados", headers=h).json()["rondas"][0]
    assert r["decisao"]["tipo"] == "sem_votos" and r["total_votos"] == 0

    eid2, (a2, b2, c2) = eleicao_em_curso(client, h, [u.id for u in us])
    _votar(client, eid2, 1, hs, [a2, b2])
    client.post(f"/eleicoes/{eid2}/rondas/1/encerrar", headers=h)
    client.post(f"/eleicoes/{eid2}/rondas/1/apurar", headers=h)
    d = client.get(f"/eleicoes/{eid2}/resultados", headers=h).json()["rondas"][0]["decisao"]
    assert d["tipo"] == "segunda_volta" and sorted(d["candidatos"]) == sorted([a2, b2])


def test_voto_adulterado_e_detetado(client, admin, criar_utilizador, login, db):
    _, h = admin
    us, hs = _eleitores(criar_utilizador, login, 3)
    eid, (a, b, c) = eleicao_em_curso(client, h, [u.id for u in us])
    recibos = []
    for hh, cand in zip(hs, [a, a, b]):
        recibos.append(client.post(f"/eleicoes/{eid}/rondas/1/votos", json={"candidato_id": cand},
                                   headers=hh).json()["recibo"])
    # alguém com acesso à BD muda um voto de A para C
    db.execute(text("UPDATE voto SET vot_cand_id = :c WHERE vot_id = :v"), {"c": c, "v": recibos[0]})
    db.commit()
    assert client.get(f"/votos/{recibos[0]}", headers=hs[0]).json()["integro"] is False
    client.post(f"/eleicoes/{eid}/rondas/1/encerrar", headers=h)
    ap = client.post(f"/eleicoes/{eid}/rondas/1/apurar", headers=h).json()
    assert ap["votos_invalidos"] == 1 and ap["votos_validos"] == 2 and ap["consistente"] is False
    linhas = client.get(f"/eleicoes/{eid}/resultados", headers=h).json()["rondas"][0]["candidatos"]
    assert {x["candidato_id"]: x["votos"] for x in linhas} == {a: 1, b: 1, c: 0}  # o voto alterado não conta


def test_estatisticas_so_para_admin(client, admin, criar_utilizador, login):
    _, h = admin
    us, hs = _eleitores(criar_utilizador, login, 3)
    eid, (a, *_) = eleicao_em_curso(client, h, [u.id for u in us])
    _votar(client, eid, 1, hs[:2], [a, a])
    est = client.get(f"/eleicoes/{eid}/estatisticas", headers=h).json()
    assert est["habilitados"] == 3 and est["rondas"][0]["votantes"] == 2
    assert est["rondas"][0]["taxa_participacao"] == "66.67"
    assert client.get(f"/eleicoes/{eid}/estatisticas", headers=hs[0]).status_code == 403


def test_worker_encerra_e_apura_quando_o_periodo_acaba(client, admin, criar_utilizador, login, db):
    from app.services.apuramento import ciclo_automatico

    _, h = admin
    us, hs = _eleitores(criar_utilizador, login, 2)
    eid, (a, b, _) = eleicao_em_curso(client, h, [u.id for u in us])
    _votar(client, eid, 1, hs, [a, a])

    nada = ciclo_automatico(db)  # período ainda a decorrer: não faz nada
    assert nada["encerradas"] == [] and nada["apuradas"] == []

    depois = datetime.now(timezone.utc) + timedelta(hours=2)
    r = ciclo_automatico(db, agora=depois)
    assert r["encerradas"] == [(eid, 1)]
    assert r["apuradas"][0]["votos_validos"] == 2 and r["apuradas"][0]["consistente"] is True
    res = client.get(f"/eleicoes/{eid}/resultados", headers=hs[0]).json()["rondas"][0]
    assert res["estado"] == "apurada" and res["decisao"] == {"tipo": "vencedor", "candidatos": [a]}
    assert ciclo_automatico(db, agora=depois)["apuradas"] == []  # idempotente
