"""Regras das mensagens de contacto: limite de envios por IP, leitura pela equipa."""

from sqlalchemy.orm import Session

from app import cache
from app.erros import MuitasTentativasError, NaoEncontradoError
from app.models.mensagem import MensagemContacto
from app.repositories import mensagem as repositorio
from app.schemas.mensagem import MensagemNova

# No máximo 5 mensagens por hora a partir do mesmo IP (evita spam no formulário público).
LIMITE_POR_HORA = 5


def enviar(sessao: Session, dados: MensagemNova, ip: str | None) -> MensagemContacto:
    if cache.contar_envio(f"contacto:{ip or 'desconhecido'}", 3600) > LIMITE_POR_HORA:
        raise MuitasTentativasError(
            "Enviou várias mensagens seguidas. Tente de novo daqui a uma hora ou use o e-mail."
        )
    return repositorio.criar(
        sessao,
        MensagemContacto(
            nome=dados.nome.strip(),
            email=dados.email.strip().lower(),
            assunto=dados.assunto.strip(),
            mensagem=dados.mensagem.strip(),
        ),
    )


def listar(sessao: Session) -> list[MensagemContacto]:
    return repositorio.listar(sessao)


def marcar(sessao: Session, mensagem_id: int, lida: bool) -> MensagemContacto:
    mensagem = repositorio.obter(sessao, mensagem_id)
    if mensagem is None:
        raise NaoEncontradoError("Mensagem não encontrada.")
    mensagem.lida = lida
    repositorio.guardar(sessao)
    return mensagem
