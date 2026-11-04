"""Liderança dos workers: só um apura, e a reserva cede ao principal."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.pool import NullPool

from app import worker


@pytest.fixture(autouse=True)
def chaves_de_teste(monkeypatch):
    # Os advisory locks valem para toda a BD: chaves próprias, para não chocar com os
    # workers do Docker que estejam a correr na mesma base de dados.
    monkeypatch.setattr(worker, "_CHAVE_LIDER", 7_249_013)
    monkeypatch.setattr(worker, "_CHAVE_PRINCIPAL", 7_249_014)


@pytest.fixture
def motor(motor):
    """Sem pool, como o worker: fechar a ligação liberta os locks."""
    sem_pool = create_engine(motor.url, poolclass=NullPool)
    yield sem_pool
    sem_pool.dispose()


def teste_so_um_worker_lidera(motor):
    with motor.connect() as principal, motor.connect() as reserva:
        assert worker._tentar(principal, worker._CHAVE_LIDER) is True
        assert worker._tentar(reserva, worker._CHAVE_LIDER) is False
    # Ligação fechada (worker parado ou BD perdida): o lock fica livre.
    with motor.connect() as reserva:
        assert worker._tentar(reserva, worker._CHAVE_LIDER) is True


def teste_reserva_ve_o_principal(motor):
    with motor.connect() as reserva:
        assert worker._principal_presente(reserva) is False
        with motor.connect() as principal:
            worker._tentar(principal, worker._CHAVE_PRINCIPAL)
            assert worker._principal_presente(reserva) is True
        assert worker._principal_presente(reserva) is False
