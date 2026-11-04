"""Auditoria (cadeia de hashes) e sondagem."""

from app.testes.conftest import cabecalho, entrar


def teste_acoes_ficam_registadas_e_cadeia_valida(cliente, admin, eleicao_em_curso):
    h = cabecalho(admin)
    registos = cliente.get("/auditoria", headers=h).json()
    acoes = [r["acao"] for r in registos]
    for esperada in ("Eleição criada", "Candidato adicionado", "Eleição agendada", "Votação iniciada"):
        assert esperada in acoes
    # Mais recente primeiro.
    assert registos[0]["id"] > registos[-1]["id"]
    verificacao = cliente.get("/auditoria/verificar", headers=h).json()
    assert verificacao["valida"] is True and verificacao["total"] == len(registos)


def teste_voto_nao_fica_na_auditoria(cliente, admin, eleicao_em_curso):
    e = eleicao_em_curso
    cliente.post(
        f"/eleicoes/{e['id']}/rondas/1/votos",
        json={"candidato_id": e["candidatos"][0]},
        headers=cabecalho(entrar(cliente, "ana")),
    )
    registos = cliente.get("/auditoria", headers=cabecalho(admin)).json()
    assert not any("voto" in r["acao"].lower() for r in registos)
    assert not any(e["candidatos"][0] == (r["detalhes"] or {}).get("candidato_id") for r in registos)


def teste_adulterar_a_auditoria_e_detetado(cliente, admin, eleicao_em_curso, sql):
    h = cabecalho(admin)
    alvo = sql("SELECT aud_id FROM auditoria ORDER BY aud_id LIMIT 1 OFFSET 2").scalar()
    sql("UPDATE auditoria SET aud_acao = 'Nada a ver' WHERE aud_id = :i", i=alvo)
    verificacao = cliente.get("/auditoria/verificar", headers=h).json()
    assert verificacao == {"valida": False, "total": 3, "primeiro_invalido": alvo}


def teste_sondagem(cliente, eleicao_em_curso):
    e = eleicao_em_curso
    h = cabecalho(entrar(cliente, "ana"))
    inicial = cliente.get(f"/eleicoes/{e['id']}/sondagem", headers=h).json()
    assert inicial["amostra"] == 0 and inicial["respondeu"] is False
    assert [p["percentagem"] for p in inicial["projecao"]] == [50.0, 50.0]

    rota = f"/eleicoes/{e['id']}/sondagem/respostas"
    assert cliente.post(rota, json={"candidato_id": e["candidatos"][0]}, headers=h).status_code == 204
    assert cliente.post(rota, json={"candidato_id": e["candidatos"][0]}, headers=h).status_code == 409
    assert cliente.post(rota, json={"candidato_id": 999}, headers=cabecalho(entrar(cliente, "bruno"))).status_code == 400

    depois = cliente.get(f"/eleicoes/{e['id']}/sondagem", headers=h).json()
    assert depois["amostra"] == 1 and depois["respondeu"] is True
    # Prior uniforme: (1+1)/(1+2) = 66,7% para quem recebeu a resposta.
    assert depois["projecao"][0] == {"candidato_id": e["candidatos"][0], "nome": "Lista A", "percentagem": 66.7}
