"""Votação (RF06, RF07, RF08): regras do voto, anonimato, recibo e concorrência."""
import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, text

from app.models import Auditoria, Participacao, Voto


def _iso(delta_h: float) -> str:
    return (datetime.now(timezone.utc) + timedelta(hours=delta_h)).isoformat()


def eleicao_em_curso(client, h, eleitor_ids, n_candidatos=3, inicio_h=-1.0, fim_h=1.0, iniciar=True):
    """Cria uma eleição com ronda 1 a decorrer agora e os eleitores habilitados."""
    eid = client.post("/eleicoes", json={"titulo": "Presidenciais 2026"}, headers=h).json()["id"]
    cands = [client.post(f"/eleicoes/{eid}/candidatos", json={"nome": f"Candidato {i}"}, headers=h).json()["id"]
             for i in range(1, n_candidatos + 1)]
    assert client.post(f"/eleicoes/{eid}/rondas", json={"data_inicio": _iso(inicio_h), "data_fim": _iso(fim_h)},
                       headers=h).status_code == 201
    assert client.post(f"/eleicoes/{eid}/habilitados", json={"utilizador_ids": list(eleitor_ids)},
                       headers=h).status_code == 200
    assert client.post(f"/eleicoes/{eid}/agendar", headers=h).status_code == 200
    if iniciar:
        assert client.post(f"/eleicoes/{eid}/iniciar", headers=h).status_code == 200
    return eid, cands


def test_voto_aceite_com_recibo_e_anonimo(client, admin, eleitor, db):
    (_, h), (u, he) = admin, eleitor
    eid, (c1, c2, c3) = eleicao_em_curso(client, h, [u.id])
    r = client.post(f"/eleicoes/{eid}/rondas/1/votos", json={"candidato_id": c2}, headers=he)
    assert r.status_code == 201, r.text
    recibo = r.json()["recibo"]

    # participação sabe QUEM votou; o voto sabe EM QUEM, sem ligação ao eleitor
    assert db.scalar(select(Participacao).where(Participacao.utilizador_id == u.id)) is not None
    voto = db.scalar(select(Voto))
    assert str(voto.id) == recibo and voto.candidato_id == c2 and len(voto.hash) == 64
    colunas_voto = set(db.execute(text("SELECT column_name FROM information_schema.columns "
                                       "WHERE table_name='voto' AND table_schema=current_schema()")).scalars())
    assert not any("ut" in c or "data" in c for c in colunas_voto)
    # a auditoria não guarda o candidato
    aud = db.scalar(select(Auditoria).where(Auditoria.acao == "voto.registado"))
    assert aud.utilizador_id == u.id and set(aud.detalhes) == {"eleicao", "ronda"}

    part = client.get(f"/eleicoes/{eid}/minha-participacao", headers=he).json()
    assert part[0]["votou"] is True
    ver = client.get(f"/votos/{recibo}", headers=he).json()
    assert ver == {"registado": True, "integro": True, "eleicao_id": eid, "ronda": 1}
    assert client.get("/votos/00000000-0000-0000-0000-000000000000", headers=he).json()["registado"] is False


def test_nao_vota_duas_vezes(client, admin, eleitor):
    (_, h), (u, he) = admin, eleitor
    eid, (c1, c2, _) = eleicao_em_curso(client, h, [u.id])
    assert client.post(f"/eleicoes/{eid}/rondas/1/votos", json={"candidato_id": c1}, headers=he).status_code == 201
    r = client.post(f"/eleicoes/{eid}/rondas/1/votos", json={"candidato_id": c2}, headers=he)
    assert r.status_code == 409 and "Já votou" in r.json()["detail"]


def test_dois_votos_simultaneos_do_mesmo_eleitor(client, admin, eleitor, db):
    """Como se o mesmo eleitor enviasse o voto pelas duas instâncias ao mesmo tempo."""
    from app.database import get_session_factory
    from app.services import votacao
    from app.services.erros import Conflito

    (_, h), (u, _) = admin, eleitor
    eid, (c1, c2, _) = eleicao_em_curso(client, h, [u.id])
    resultados, barreira = [], threading.Barrier(2)

    def votar(cand):
        with get_session_factory()() as s:
            eleitor_s = s.merge(u, load=True)
            barreira.wait()
            try:
                votacao.votar(s, eleitor_s, eid, 1, cand)
                resultados.append("ok")
            except Conflito:
                resultados.append("conflito")

    threads = [threading.Thread(target=votar, args=(c,)) for c in (c1, c2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    assert sorted(resultados) == ["conflito", "ok"]
    assert db.scalar(text("SELECT count(*) FROM voto")) == 1
    assert db.scalar(text("SELECT count(*) FROM participacao")) == 1


def test_quem_pode_votar(client, admin, eleitor, criar_utilizador, login):
    (_, h), (u, he) = admin, eleitor
    criar_utilizador("intruso@teste.pt", nome="Intruso")
    hi = login("intruso@teste.pt")
    eid, (c1, *_) = eleicao_em_curso(client, h, [u.id])
    assert client.post(f"/eleicoes/{eid}/rondas/1/votos", json={"candidato_id": c1}, headers=hi).status_code == 404
    assert client.post(f"/eleicoes/{eid}/rondas/1/votos", json={"candidato_id": c1}, headers=h).status_code == 403
    assert client.post(f"/eleicoes/{eid}/rondas/1/votos", json={"candidato_id": c1}).status_code == 401


def test_candidato_tem_de_concorrer_na_ronda(client, admin, eleitor):
    (_, h), (u, he) = admin, eleitor
    eid, _ = eleicao_em_curso(client, h, [u.id])
    outra = client.post("/eleicoes", json={"titulo": "Outra eleição"}, headers=h).json()["id"]
    estranho = client.post(f"/eleicoes/{outra}/candidatos", json={"nome": "Estranho"}, headers=h).json()["id"]
    assert client.post(f"/eleicoes/{eid}/rondas/1/votos", json={"candidato_id": estranho},
                       headers=he).status_code == 422
    assert client.post(f"/eleicoes/{eid}/rondas/2/votos", json={"candidato_id": estranho},
                       headers=he).status_code == 404


def test_so_vota_com_ronda_aberta_e_dentro_do_periodo(client, admin, eleitor, db):
    from app.services import votacao
    from app.services.erros import Conflito

    (_, h), (u, he) = admin, eleitor
    # agendada mas não iniciada
    eid, (c1, *_) = eleicao_em_curso(client, h, [u.id], iniciar=False)
    r = client.post(f"/eleicoes/{eid}/rondas/1/votos", json={"candidato_id": c1}, headers=he)
    assert r.status_code == 409 and "não está a decorrer" in r.json()["detail"]

    # iniciada mas o período ainda não começou
    eid2, (d1, *_) = eleicao_em_curso(client, h, [u.id], inicio_h=2, fim_h=5)
    r = client.post(f"/eleicoes/{eid2}/rondas/1/votos", json={"candidato_id": d1}, headers=he)
    assert r.status_code == 409 and "período" in r.json()["detail"]

    # período já terminou (simula a hora depois do fim)
    eid3, (e1, *_) = eleicao_em_curso(client, h, [u.id])
    try:
        votacao.votar(db, db.merge(u), eid3, 1, e1, agora=datetime.now(timezone.utc) + timedelta(hours=2))
        assert False, "devia recusar"
    except Conflito as e:
        assert "período" in e.mensagem
    db.rollback()

    # ronda encerrada
    client.post(f"/eleicoes/{eid3}/rondas/1/encerrar", headers=h)
    r = client.post(f"/eleicoes/{eid3}/rondas/1/votos", json={"candidato_id": e1}, headers=he)
    assert r.status_code == 409 and "não está aberta" in r.json()["detail"]
