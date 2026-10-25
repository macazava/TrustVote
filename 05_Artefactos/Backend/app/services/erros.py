"""Erros de negócio. Os services lançam-nos; o main.py converte-os em respostas HTTP."""


class ErroNegocio(Exception):
    status_code = 400

    def __init__(self, mensagem: str):
        super().__init__(mensagem)
        self.mensagem = mensagem


class NaoEncontrado(ErroNegocio):
    status_code = 404


class Conflito(ErroNegocio):
    """Pedido válido mas incompatível com o estado atual (ex.: editar eleição já iniciada)."""
    status_code = 409


class NaoAutorizado(ErroNegocio):
    status_code = 401


class Proibido(ErroNegocio):
    status_code = 403


class DadosInvalidos(ErroNegocio):
    status_code = 422
