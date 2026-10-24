"""Gestão eleitoral (RF03, RF04, RF05): eleições, rondas, candidatos, habilitações e regras de estado."""
import threading
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.models import Auditoria


def _datas(inicio_h: int = 1, dur_h: int = 24) -> dict:
    inicio = datetime.now(timezone.utc) + timedelta(hours=inicio_h)
    return {"data_inicio": inicio.isoformat(), "data_fim": (inicio + timedelta(hours=dur_h)).isoformat()}


def _eleicao(client, h, titulo="Presidenciais 2026") -> int:
    r = client.post("/eleicoes", json={"titulo": titulo, "descricao": "Eleição de teste"}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _candidato(client, h, eid, nome) -> int:
    r = client.post(f"/eleicoes/{eid}/candidatos", json={"nome": nome, "partido": "Independente"}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _eleicao_pronta(client, h_admin, eleitor_id, n_candidatos=3) -> tuple[int, list[int]]:
    """Eleição em rascunho com ronda 1, candidatos e um eleitor habilitado (pronta a agendar)."""
    eid = _eleicao(client, h_admin)
    cands = [_candidato(client, h_admin, eid, f"Candidato {i}") for i in range(1, n_candidatos + 1)]
    assert client.post(f"/eleicoes/{eid}/rondas", json=_datas(), headers=h_admin).status_code == 201
    assert client.post(f"/eleicoes/{eid}/habilitados", json={"utilizador_ids": [eleitor_id]},
                       headers=h_admin).status_code == 200
    return eid, cands


# ------------------------------------------------------------------ permissões

def test_so_admin_gere_eleicoes(client, admin, eleitor):
    (_, h_admin), (_, h_eleitor) = admin, eleitor
    assert client.post("/eleicoes", json={"titulo": "X eleição"}).status_code == 401
    assert client.post("/eleicoes", json={"titulo": "X eleição"}, headers=h_eleitor).status_code == 403
    eid = _eleicao(client, h_admin)
    for metodo, url, corpo in [
        ("post", f"/eleicoes/{eid}/candidatos", {"nome": "Fulano"}),
        ("post", f"/eleicoes/{eid}/rondas", _datas()),
        ("post", f"/eleicoes/{eid}/habilitados", {"utilizador_ids": [1]}),
        ("post", f"/eleicoes/{eid}/agendar", None),
        ("delete", f"/eleicoes/{eid}", None),
    ]:
        r = client.request(metodo.upper(), url, json=corpo, headers=h_eleitor)
        assert r.status_code == 403, (url, r.status_code)


# ------------------------------------------------------------------ ciclo de vida completo

def test_ciclo_de_vida_com_segunda_volta(client, admin, eleitor, db):
    (_, h), (u_eleitor, _) = admin, eleitor
    eid, (c1, c2, c3) = _eleicao_pronta(client, h, u_eleitor.id)

    r = client.post(f"/eleicoes/{eid}/agendar", headers=h)
    assert r.status_code == 200 and r.json()["estado"] == "agendada"
    assert [c["id"] for c in r.json()["rondas"][0]["candidatos"]] == [c1, c2, c3]

    r = client.post(f"/eleicoes/{eid}/iniciar", headers=h)
    assert r.json()["estado"] == "em_curso" and r.json()["rondas"][0]["estado"] == "aberta"

    # 2.ª volta só depois de encerrar a 1.ª
    ronda2 = {**_datas(inicio_h=48), "candidato_ids": [c1, c3]}
    assert client.post(f"/eleicoes/{eid}/rondas", json=ronda2, headers=h).status_code == 409
    assert client.post(f"/eleicoes/{eid}/rondas/1/encerrar", headers=h).json()["estado"] == "encerrada"

    r = client.post(f"/eleicoes/{eid}/rondas", json=ronda2, headers=h)
    assert r.status_code == 201 and r.json()["numero"] == 2
    assert [c["id"] for c in r.json()["candidatos"]] == [c1, c3]
    assert client.post(f"/eleicoes/{eid}/rondas/2/abrir", headers=h).json()["estado"] == "aberta"

    r = client.post(f"/eleicoes/{eid}/encerrar", headers=h)
    assert r.json()["estado"] == "encerrada"
    assert [x["estado"] for x in r.json()["rondas"]] == ["encerrada", "encerrada"]

    acoes = set(db.scalars(select(Auditoria.acao).where(Auditoria.entidade_id == eid)))
    assert {"eleicao.criada", "eleicao.agendada", "eleicao.iniciada", "ronda.criada", "eleicao.encerrada"} <= acoes


# ------------------------------------------------------------------ regras de estado

def test_agendar_exige_ronda_candidatos_e_habilitados(client, admin, eleitor):
    (_, h), (u_eleitor, _) = admin, eleitor
    eid = _eleicao(client, h)
    r = client.post(f"/eleicoes/{eid}/agendar", headers=h)
    assert r.status_code == 409 and "ronda 1" in r.json()["detail"]
    client.post(f"/eleicoes/{eid}/rondas", json=_datas(), headers=h)
    _candidato(client, h, eid, "Só um")
    assert "2 candidatos" in client.post(f"/eleicoes/{eid}/agendar", headers=h).json()["detail"]
    _candidato(client, h, eid, "Outro")
    assert "eleitor" in client.post(f"/eleicoes/{eid}/agendar", headers=h).json()["detail"]
    client.post(f"/eleicoes/{eid}/habilitados", json={"utilizador_ids": [u_eleitor.id]}, headers=h)
    assert client.post(f"/eleicoes/{eid}/agendar", headers=h).status_code == 200


def test_candidato_inativo_nao_entra_na_ronda(client, admin, eleitor):
    (_, h), (u_eleitor, _) = admin, eleitor
    eid, (c1, c2, c3) = _eleicao_pronta(client, h, u_eleitor.id)
    assert client.patch(f"/eleicoes/{eid}/candidatos/{c2}", json={"ativo": False}, headers=h).status_code == 200
    r = client.post(f"/eleicoes/{eid}/agendar", headers=h)
    assert [c["id"] for c in r.json()["rondas"][0]["candidatos"]] == [c1, c3]


def test_depois_de_agendada_nao_se_mexe_em_candidatos(client, admin, eleitor):
    (_, h), (u_eleitor, _) = admin, eleitor
    eid, (c1, *_) = _eleicao_pronta(client, h, u_eleitor.id)
    client.post(f"/eleicoes/{eid}/agendar", headers=h)
    assert client.post(f"/eleicoes/{eid}/candidatos", json={"nome": "Tardio"}, headers=h).status_code == 409
    assert client.patch(f"/eleicoes/{eid}/candidatos/{c1}", json={"nome": "Outro"}, headers=h).status_code == 409
    assert client.delete(f"/eleicoes/{eid}/candidatos/{c1}", headers=h).status_code == 409
    assert client.delete(f"/eleicoes/{eid}", headers=h).status_code == 409  # só se apaga em rascunho
    # o título ainda pode ser corrigido enquanto agendada
    assert client.patch(f"/eleicoes/{eid}", json={"titulo": "Título corrigido"}, headers=h).status_code == 200


def test_transicoes_invalidas(client, admin, eleitor):
    (_, h), (u_eleitor, _) = admin, eleitor
    eid, _ = _eleicao_pronta(client, h, u_eleitor.id)
    assert client.post(f"/eleicoes/{eid}/iniciar", headers=h).status_code == 409    # ainda em rascunho
    assert client.post(f"/eleicoes/{eid}/encerrar", headers=h).status_code == 409
    client.post(f"/eleicoes/{eid}/agendar", headers=h)
    assert client.post(f"/eleicoes/{eid}/agendar", headers=h).status_code == 409    # já agendada
    client.post(f"/eleicoes/{eid}/iniciar", headers=h)
    assert client.patch(f"/eleicoes/{eid}", json={"titulo": "Mudar a meio"}, headers=h).status_code == 409
    assert client.post(f"/eleicoes/{eid}/habilitados", json={"utilizador_ids": [u_eleitor.id]},
                       headers=h).status_code == 409
    assert client.patch(f"/eleicoes/{eid}/rondas/1", json=_datas(), headers=h).status_code == 409  # já aberta
    assert client.post(f"/eleicoes/{eid}/rondas/1/abrir", headers=h).status_code == 409
    client.post(f"/eleicoes/{eid}/encerrar", headers=h)
    assert client.post(f"/eleicoes/{eid}/iniciar", headers=h).status_code == 409


def test_regras_da_segunda_volta(client, admin, eleitor):
    (_, h), (u_eleitor, _) = admin, eleitor
    eid, (c1, c2, c3) = _eleicao_pronta(client, h, u_eleitor.id)
    for passo in ("agendar", "iniciar", "rondas/1/encerrar"):
        client.post(f"/eleicoes/{eid}/{passo}", headers=h)
    outra = _eleicao(client, h, "Outra eleição")
    estranho = _candidato(client, h, outra, "Estranho")
    tarde = _datas(inicio_h=48)
    assert client.post(f"/eleicoes/{eid}/rondas", json={**tarde, "candidato_ids": [c1, c2, c3]},
                       headers=h).status_code == 422                                   # tem de ter 2
    assert client.post(f"/eleicoes/{eid}/rondas", json={**tarde, "candidato_ids": [c1, estranho]},
                       headers=h).status_code == 422                                   # de outra eleição
    assert client.post(f"/eleicoes/{eid}/rondas", json={**_datas(inicio_h=2), "candidato_ids": [c1, c2]},
                       headers=h).status_code == 422                                   # antes do fim da ronda 1
    assert client.post(f"/eleicoes/{eid}/rondas", json={**tarde, "candidato_ids": [c1, c2]},
                       headers=h).status_code == 201
    assert client.post(f"/eleicoes/{eid}/rondas", json={**tarde, "candidato_ids": [c1, c2]},
                       headers=h).status_code == 409                                   # já há 2 rondas


def test_validacao_de_datas(client, admin):
    _, h = admin
    eid = _eleicao(client, h)
    agora = datetime.now(timezone.utc)
    invertidas = {"data_inicio": (agora + timedelta(days=2)).isoformat(),
                  "data_fim": (agora + timedelta(days=1)).isoformat()}
    assert client.post(f"/eleicoes/{eid}/rondas", json=invertidas, headers=h).status_code == 422
    sem_fuso = {"data_inicio": "2030-01-01T09:00:00", "data_fim": "2030-01-01T19:00:00"}
    assert client.post(f"/eleicoes/{eid}/rondas", json=sem_fuso, headers=h).status_code == 422
    assert client.post(f"/eleicoes/{eid}/rondas", json={**_datas(), "candidato_ids": [1, 2]},
                       headers=h).status_code == 422                                   # ids só na 2.ª volta
    passado = {"data_inicio": (agora - timedelta(days=3)).isoformat(),
               "data_fim": (agora - timedelta(days=2)).isoformat()}
    assert client.post(f"/eleicoes/{eid}/rondas", json=passado, headers=h).status_code == 201
    assert client.patch(f"/eleicoes/{eid}/rondas/1", json=invertidas, headers=h).status_code == 422


def test_agendar_com_ronda_ja_terminada_e_recusado(client, admin, eleitor):
    (_, h), (u_eleitor, _) = admin, eleitor
    eid = _eleicao(client, h)
    _candidato(client, h, eid, "Candidato A")
    _candidato(client, h, eid, "Candidato B")
    client.post(f"/eleicoes/{eid}/habilitados", json={"utilizador_ids": [u_eleitor.id]}, headers=h)
    agora = datetime.now(timezone.utc)
    client.post(f"/eleicoes/{eid}/rondas", json={"data_inicio": (agora - timedelta(days=3)).isoformat(),
                                                 "data_fim": (agora - timedelta(days=2)).isoformat()}, headers=h)
    r = client.post(f"/eleicoes/{eid}/agendar", headers=h)
    assert r.status_code == 409 and "terminou" in r.json()["detail"]


# ------------------------------------------------------------------ habilitações

def test_habilitacoes(client, admin, eleitor, criar_utilizador):
    (u_admin, h), (u_eleitor, _) = admin, eleitor
    outro = criar_utilizador("outro@teste.pt", nome="Outro Eleitor")
    eid = _eleicao(client, h)
    r = client.post(f"/eleicoes/{eid}/habilitados", json={"utilizador_ids": [u_eleitor.id, outro.id]}, headers=h)
    assert r.json() == {"adicionados": 2, "ja_habilitados": 0}
    r = client.post(f"/eleicoes/{eid}/habilitados", json={"utilizador_ids": [u_eleitor.id]}, headers=h)
    assert r.json() == {"adicionados": 0, "ja_habilitados": 1}
    assert client.post(f"/eleicoes/{eid}/habilitados", json={"utilizador_ids": [u_admin.id]},
                       headers=h).status_code == 422                                   # admin não vota
    assert client.post(f"/eleicoes/{eid}/habilitados", json={"utilizador_ids": [999999]},
                       headers=h).status_code == 404
    lista = client.get(f"/eleicoes/{eid}/habilitados", headers=h).json()
    assert {x["email"] for x in lista} == {"eleitor@teste.pt", "outro@teste.pt"}
    assert client.delete(f"/eleicoes/{eid}/habilitados/{outro.id}", headers=h).status_code == 204
    assert client.delete(f"/eleicoes/{eid}/habilitados/{outro.id}", headers=h).status_code == 404
    assert len(client.get(f"/eleicoes/{eid}/habilitados", headers=h).json()) == 1


def test_eleitor_inativo_nao_pode_ser_habilitado(client, admin, eleitor):
    (_, h), (u_eleitor, _) = admin, eleitor
    client.patch(f"/utilizadores/{u_eleitor.id}", json={"ativo": False}, headers=h)
    eid = _eleicao(client, h)
    assert client.post(f"/eleicoes/{eid}/habilitados", json={"utilizador_ids": [u_eleitor.id]},
                       headers=h).status_code == 422


# ------------------------------------------------------------------ visibilidade (RF05)

def test_eleitor_so_ve_eleicoes_em_que_esta_habilitado_e_nao_rascunho(client, admin, eleitor, criar_utilizador, login):
    (_, h), (u_eleitor, h_eleitor) = admin, eleitor
    criar_utilizador("intruso@teste.pt", nome="Intruso")
    h_intruso = login("intruso@teste.pt")
    eid, _ = _eleicao_pronta(client, h, u_eleitor.id)
    _eleicao(client, h, "Eleição alheia")

    # em rascunho: invisível mesmo para o habilitado
    assert client.get("/eleicoes", headers=h_eleitor).json() == []
    assert client.get(f"/eleicoes/{eid}", headers=h_eleitor).status_code == 404

    client.post(f"/eleicoes/{eid}/agendar", headers=h)
    assert [e["id"] for e in client.get("/eleicoes", headers=h_eleitor).json()] == [eid]
    detalhe = client.get(f"/eleicoes/{eid}", headers=h_eleitor)
    assert detalhe.status_code == 200 and len(detalhe.json()["candidatos"]) == 3

    # não habilitado: não vê nada (404, não revela que existe)
    assert client.get("/eleicoes", headers=h_intruso).json() == []
    assert client.get(f"/eleicoes/{eid}", headers=h_intruso).status_code == 404
    assert client.get(f"/eleicoes/{eid}/habilitados", headers=h_eleitor).status_code == 403

    # o admin vê tudo, e pode filtrar por estado
    assert len(client.get("/eleicoes", headers=h).json()) == 2
    assert [e["id"] for e in client.get("/eleicoes?estado=agendada", headers=h).json()] == [eid]


def test_apagar_rascunho(client, admin):
    _, h = admin
    eid = _eleicao(client, h)
    _candidato(client, h, eid, "Candidato A")
    client.post(f"/eleicoes/{eid}/rondas", json=_datas(), headers=h)
    assert client.delete(f"/eleicoes/{eid}", headers=h).status_code == 204
    assert client.get(f"/eleicoes/{eid}", headers=h).status_code == 404


# ------------------------------------------------------------------ concorrência

def test_agendar_em_simultaneo_so_um_pedido_ganha(client, admin, eleitor):
    """Simula dois pedidos ao mesmo tempo (como se viessem pelas duas instâncias do backend):
    o SELECT ... FOR UPDATE garante que só um muda o estado; o outro recebe 409."""
    from app.database import get_session_factory
    from app.services import eleicao as servico
    from app.services.erros import Conflito

    (u_admin, h), (u_eleitor, _) = admin, eleitor
    eid, _ = _eleicao_pronta(client, h, u_eleitor.id)
    resultados, barreira = [], threading.Barrier(2)

    def agendar():
        with get_session_factory()() as s:
            adm = s.merge(u_admin, load=True)
            barreira.wait()
            try:
                servico.agendar(s, adm, eid)
                resultados.append("ok")
            except Conflito:
                resultados.append("conflito")

    threads = [threading.Thread(target=agendar) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=30)
    assert sorted(resultados) == ["conflito", "ok"]
