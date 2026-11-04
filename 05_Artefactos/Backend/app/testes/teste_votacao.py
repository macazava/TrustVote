"""Voto, voto em branco, recibo, apuramento, quórum e integridade."""

from datetime import datetime, timedelta, timezone

from app.services import apuramento
from app.tarefas import apurar_pendentes, executar_tarefas
from app.testes.conftest import cabecalho, entrar


def _votar(cliente, eleicao_id, nome, **corpo):
    return cliente.post(
        f"/eleicoes/{eleicao_id}/rondas/1/votos",
        json=corpo,
        headers=cabecalho(entrar(cliente, nome)),
    )


def teste_voto_recibo_e_repeticao(cliente, eleicao_em_curso):
    e = eleicao_em_curso
    voto = _votar(cliente, e["id"], "ana", candidato_id=e["candidatos"][0])
    assert voto.status_code == 201
    recibo = voto.json()["recibo"]

    assert _votar(cliente, e["id"], "ana", candidato_id=e["candidatos"][1]).status_code == 409

    h = cabecalho(entrar(cliente, "ana"))
    verificado = cliente.get(f"/recibos/{recibo}/verificar", headers=h).json()
    assert verificado == {"valido": True, "incluido": True, "ronda": 1}
    assert cliente.get(f"/eleicoes/{e['id']}/participacao", headers=h).json() == {"votou": True}


def teste_pedido_de_voto_tem_de_ser_claro(cliente, eleicao_em_curso):
    e = eleicao_em_curso
    assert _votar(cliente, e["id"], "ana").status_code == 422
    assert _votar(cliente, e["id"], "ana", branco=True, candidato_id=e["candidatos"][0]).status_code == 422


def teste_apuramento_com_brancos_e_quorum(cliente, admin, eleicao_em_curso, sql):
    e = eleicao_em_curso
    _votar(cliente, e["id"], "ana", candidato_id=e["candidatos"][0])
    _votar(cliente, e["id"], "bruno", branco=True)

    # Os eleitores não veem resultados com a votação aberta.
    h_ana = cabecalho(entrar(cliente, "ana"))
    assert cliente.get(f"/eleicoes/{e['id']}/resultados", headers=h_ana).status_code == 409

    h = cabecalho(admin)
    assert cliente.post(f"/eleicoes/{e['id']}/rondas/1/encerrar", headers=h).json()["estado"] == "apurada"
    assert sql("SELECT count(*) FROM resultado").scalar() == 3  # 2 candidatos + brancos

    [ronda] = cliente.get(f"/eleicoes/{e['id']}/resultados", headers=h_ana).json()
    assert ronda["apurada"] and ronda["brancos"] == 1 and ronda["invalidos"] == 0
    votos = {c["id"]: c for c in ronda["candidatos"]}
    assert votos[e["candidatos"][0]]["total_votos"] == 1
    assert votos[e["candidatos"][0]]["percentagem"] == 100.0
    # 2 de 3 votaram: 66,7% ≥ quórum de 50%.
    assert ronda["votantes"] == 2 and ronda["habilitados"] == 3
    assert ronda["quorum_atingido"] is True


def teste_apuramento_desliga_votos_das_participacoes(cliente, admin, eleicao_em_curso, sql):
    e = eleicao_em_curso
    for nome in ("ana", "bruno", "carla"):
        _votar(cliente, e["id"], nome, candidato_id=e["candidatos"][0])
    # Com a volta aberta, voto e participação foram gravados na mesma transação.
    ligados = "SELECT count(*) FROM voto v JOIN participacao p ON p.xmin = v.xmin"
    assert sql(ligados).scalar() == 3

    cliente.post(f"/eleicoes/{e['id']}/rondas/1/encerrar", headers=cabecalho(admin)).raise_for_status()
    assert sql(ligados).scalar() == 0
    [ronda] = cliente.get(f"/eleicoes/{e['id']}/resultados", headers=cabecalho(admin)).json()
    assert ronda["invalidos"] == 0 and ronda["votantes"] == 3


def teste_voto_adulterado_nao_conta(cliente, admin, eleicao_em_curso, sql):
    e = eleicao_em_curso
    recibo = _votar(cliente, e["id"], "ana", candidato_id=e["candidatos"][0]).json()["recibo"]
    _votar(cliente, e["id"], "bruno", candidato_id=e["candidatos"][0])

    # Alguém com acesso à BD troca o candidato de um voto.
    sql(
        "UPDATE voto SET vot_cand_id = :novo WHERE vot_id = (SELECT vot_id FROM voto LIMIT 1)",
        novo=e["candidatos"][1],
    )
    h = cabecalho(admin)
    integridade = cliente.get(f"/eleicoes/{e['id']}/integridade", headers=h).json()
    assert integridade["valida"] is False
    assert integridade["rondas"][0]["selos_invalidos"] == 1

    [ronda] = cliente.get(f"/eleicoes/{e['id']}/resultados", headers=h).json()
    assert ronda["invalidos"] == 1
    assert sum(c["total_votos"] for c in ronda["candidatos"]) == 1

    # Depois de apurada, a volta continua a indicar o voto excluído.
    cliente.post(f"/eleicoes/{e['id']}/rondas/1/encerrar", headers=h).raise_for_status()
    [ronda] = cliente.get(f"/eleicoes/{e['id']}/resultados", headers=h).json()
    assert ronda["apurada"] and ronda["invalidos"] == 1

    # Um voto apagado também é detetado: a urna deixa de bater certo com as participações.
    sql("DELETE FROM voto WHERE vot_hash <> (SELECT vot_hash FROM voto LIMIT 1)")
    integridade = cliente.get(f"/eleicoes/{e['id']}/integridade", headers=h).json()
    assert integridade["rondas"][0]["coincide"] is False
    assert recibo  # o recibo continua a ser do eleitor; o servidor não o guarda


def teste_fecho_automatico(cliente, admin, eleicao_em_curso, Sessao, sql):
    e = eleicao_em_curso
    _votar(cliente, e["id"], "ana", candidato_id=e["candidatos"][1])
    sql("UPDATE ronda SET ron_data_fim = now() - interval '1 minute'")

    with Sessao() as sessao:
        executar_tarefas(sessao)

    assert sql("SELECT ron_estado FROM ronda").scalar() == "apurada"
    acoes = sql("SELECT aud_acao FROM auditoria WHERE aud_ut_id IS NULL").scalars().all()
    assert "Volta encerrada e apurada automaticamente" in acoes


def teste_apuramento_pelo_worker(cliente, admin, eleicao_em_curso, Sessao, sql, monkeypatch):
    monkeypatch.setattr(apuramento, "NO_WORKER", True)
    e = eleicao_em_curso
    _votar(cliente, e["id"], "ana", candidato_id=e["candidatos"][0])
    h = cabecalho(admin)

    # A API só fecha a votação; o apuramento fica à espera do worker.
    ronda = cliente.post(f"/eleicoes/{e['id']}/rondas/1/encerrar", headers=h).json()
    assert ronda["estado"] == "encerrada"
    assert sql("SELECT count(*) FROM resultado").scalar() == 0
    assert _votar(cliente, e["id"], "bruno", candidato_id=e["candidatos"][0]).status_code == 400

    with Sessao() as sessao:
        assert apurar_pendentes(sessao) == 1
        assert apurar_pendentes(sessao) == 0  # já apurada: nada a fazer
    assert sql("SELECT ron_estado FROM ronda").scalar() == "apurada"
    [resultado] = cliente.get(f"/eleicoes/{e['id']}/resultados", headers=h).json()
    assert resultado["apurada"] and resultado["votantes"] == 1
    acoes = sql("SELECT aud_acao FROM auditoria").scalars().all()
    assert "Volta encerrada" in acoes and "Volta apurada" in acoes


def teste_inicio_automatico_de_eleicao_agendada(cliente, admin, eleicao_em_curso, Sessao, sql):
    h = cabecalho(admin)
    agora = datetime.now(timezone.utc)
    nova = cliente.post("/eleicoes", json={"titulo": "Conselho Fiscal"}, headers=h).json()
    cliente.post(
        f"/eleicoes/{nova['id']}/rondas",
        json={
            "data_inicio": (agora + timedelta(hours=1)).isoformat(),
            "data_fim": (agora + timedelta(hours=2)).isoformat(),
        },
        headers=h,
    ).raise_for_status()
    for nome in ("X", "Y"):
        cliente.post(f"/eleicoes/{nova['id']}/candidatos", json={"nome": nome}, headers=h)
    ids = [u["id"] for u in cliente.get("/utilizadores?perfil=eleitor", headers=h).json()]
    cliente.post(f"/eleicoes/{nova['id']}/habilitados", json={"utilizador_ids": ids}, headers=h)
    assert cliente.post(f"/eleicoes/{nova['id']}/agendar", headers=h).status_code == 200

    with Sessao() as sessao:
        executar_tarefas(sessao)
    assert cliente.get(f"/eleicoes/{nova['id']}", headers=h).json()["estado"] == "agendada"

    sql("UPDATE ronda SET ron_data_inicio = now() - interval '1 minute' WHERE ron_ele_id = :e", e=nova["id"])
    with Sessao() as sessao:
        executar_tarefas(sessao)
    detalhe = cliente.get(f"/eleicoes/{nova['id']}", headers=h).json()
    assert detalhe["estado"] == "em_curso" and detalhe["rondas"][0]["estado"] == "aberta"


def teste_encerrar_eleicao_apura_tudo(cliente, admin, eleicao_em_curso, sql):
    e = eleicao_em_curso
    _votar(cliente, e["id"], "carla", candidato_id=e["candidatos"][0])
    resposta = cliente.post(f"/eleicoes/{e['id']}/encerrar", headers=cabecalho(admin)).json()
    assert resposta["estado"] == "encerrada"
    assert resposta["rondas"][0]["estado"] == "apurada"
    historico = cliente.get("/publico/historico").json()
    assert historico[0]["votos"] == 1 and historico[0]["eleitores"] == 3
    assert historico[0]["apurada_em"] is not None


def teste_configuracao_publica(cliente):
    config = cliente.get("/publico/configuracao").json()
    assert config["sessao_minutos"] > 0 and config["login_tentativas"] > 0
    assert config["apuramento"] in ("imediato", "worker")
