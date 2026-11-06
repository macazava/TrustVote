"""Migrações: ordem, uma só vez, migração alterada e migração que falha."""

import pytest
from sqlalchemy import create_engine, text

from app import migracoes
from app.database import DATABASE_URL

ESQUEMA = "teste_migracoes"
CHAVE = migracoes.CHAVE_LOCK + 9_001  # não colide com o serviço "migracoes" do Docker


@pytest.fixture
def motor(motor):  # noqa: F811 (o fixture "motor" do conftest garante que há BD)
    base = create_engine(DATABASE_URL)
    with base.begin() as c:
        c.execute(text(f"DROP SCHEMA IF EXISTS {ESQUEMA} CASCADE"))
        c.execute(text(f"CREATE SCHEMA {ESQUEMA}"))
    proprio = create_engine(DATABASE_URL, connect_args={"options": f"-csearch_path={ESQUEMA}"})
    yield proprio
    proprio.dispose()
    with base.begin() as c:
        c.execute(text(f"DROP SCHEMA {ESQUEMA} CASCADE"))
    base.dispose()


def escrever(pasta, nome, sql):
    (pasta / nome).write_text(sql, encoding="utf-8")


def aplicadas(motor):
    with motor.connect() as c:
        return c.execute(text("SELECT smi_nome FROM schema_migracao ORDER BY smi_versao")).scalars().all()


def teste_aplica_por_ordem_e_so_uma_vez(motor, tmp_path):
    escrever(tmp_path, "002_coluna.sql", "ALTER TABLE exemplo ADD COLUMN nota TEXT;")
    escrever(tmp_path, "001_tabela.sql", "CREATE TABLE exemplo (id INT PRIMARY KEY);")
    assert migracoes.aplicar(motor, tmp_path, CHAVE) == ["001_tabela.sql", "002_coluna.sql"]
    assert migracoes.aplicar(motor, tmp_path, CHAVE) == [], "a segunda vez não aplica nada"
    assert aplicadas(motor) == ["001_tabela.sql", "002_coluna.sql"]

    escrever(tmp_path, "003_indice.sql", "CREATE INDEX exemplo_nota ON exemplo (nota);")
    assert migracoes.aplicar(motor, tmp_path, CHAVE) == ["003_indice.sql"], "só a nova"


def teste_migracao_alterada_depois_de_aplicada_e_recusada(motor, tmp_path):
    escrever(tmp_path, "001_tabela.sql", "CREATE TABLE exemplo (id INT);")
    migracoes.aplicar(motor, tmp_path, CHAVE)
    escrever(tmp_path, "001_tabela.sql", "CREATE TABLE exemplo (id INT, outra INT);")
    with pytest.raises(migracoes.MigracaoError, match="alterada depois de aplicada"):
        migracoes.aplicar(motor, tmp_path, CHAVE)


def teste_migracao_que_falha_nao_deixa_nada_a_meio(motor, tmp_path):
    escrever(tmp_path, "001_tabela.sql", "CREATE TABLE exemplo (id INT);")
    escrever(tmp_path, "002_erro.sql", "CREATE TABLE meio_feita (id INT);\nSELECT coluna_que_nao_existe FROM exemplo;")
    with pytest.raises(migracoes.MigracaoError, match="002_erro.sql falhou"):
        migracoes.aplicar(motor, tmp_path, CHAVE)
    assert aplicadas(motor) == ["001_tabela.sql"]
    with motor.connect() as c:
        assert c.execute(text("SELECT to_regclass('meio_feita')")).scalar() is None, "a transação foi desfeita"


def teste_nomes_invalidos_ou_repetidos(tmp_path):
    escrever(tmp_path, "1_curto.sql", "SELECT 1;")
    with pytest.raises(migracoes.MigracaoError, match="Nome inválido"):
        migracoes.migracoes(tmp_path)
    (tmp_path / "1_curto.sql").unlink()
    escrever(tmp_path, "001_a.sql", "SELECT 1;")
    escrever(tmp_path, "001_b.sql", "SELECT 1;")
    with pytest.raises(migracoes.MigracaoError, match="repetida"):
        migracoes.migracoes(tmp_path)


def teste_migracoes_do_projeto_aplicadas_no_esquema_dos_testes(motor):
    # O conftest cria o esquema com o trustvote.sql e aplica as migrações do projeto
    with create_engine(DATABASE_URL, connect_args={"options": "-csearch_path=teste_pytest"}).connect() as c:
        nomes = c.execute(text("SELECT smi_nome FROM schema_migracao")).scalars().all()
        descricao = c.execute(text("SELECT obj_description('utilizador'::regclass)")).scalar()
    assert nomes == [nome for _, nome, _, _ in migracoes.migracoes()]
    assert descricao and descricao.startswith("Contas")
