"""Ligação ao primário (escritas) e à réplica (leituras), com vários hosts para o failover."""
from sqlalchemy import text


def test_url_com_varios_hosts_e_papel():
    from app.config import url_bd

    escrita = url_bd("db-primary, db-replica", "read-write")
    assert escrita.query == {"host": "db-primary,db-replica", "target_session_attrs": "read-write"}
    leitura = url_bd("db-replica,db-primary,db-primary,db-replica", "prefer-standby")
    assert leitura.query["host"] == "db-replica,db-primary"  # sem repetidos, pela ordem dada
    assert leitura.query["target_session_attrs"] == "prefer-standby"


def test_bd_em_baixo_da_503_e_nao_500(client):
    from sqlalchemy import create_engine
    from sqlalchemy.orm import Session

    from app.database import get_db_leitura
    from main import app

    morta = create_engine("postgresql+psycopg2://x:y@127.0.0.1:1/nada", connect_args={"connect_timeout": 1})

    def bd_morta():
        with Session(morta) as s:
            yield s
    app.dependency_overrides[get_db_leitura] = bd_morta
    try:
        r = client.get("/publico/resumo")
    finally:
        app.dependency_overrides.clear()
    assert r.status_code == 503 and "indisponível" in r.json()["detail"]


def test_sessao_de_leitura_funciona(client):
    from app.database import get_session_factory_leitura

    with get_session_factory_leitura()() as s:
        assert s.execute(text("SELECT 1")).scalar() == 1
    # as rotas que usam a réplica respondem normalmente
    assert client.get("/publico/resumo").status_code == 200
