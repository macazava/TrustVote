"""Endpoints das mensagens de contacto: enviar (público) e ler (só administradores)."""

from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session

from app.database import obter_sessao
from app.schemas.mensagem import MensagemEstado, MensagemNova, MensagemResposta
from app.security.dependencias import exigir_administrador, ip_do_pedido
from app.services import mensagem as servico

mensagem_routers = APIRouter(prefix="/contactos", tags=["contactos"])


@mensagem_routers.post("", response_model=MensagemResposta, status_code=status.HTTP_201_CREATED)
def enviar_mensagem(dados: MensagemNova, pedido: Request, sessao: Session = Depends(obter_sessao)):
    """Formulário da página Ajuda → Contactos (sem sessão; limite de envios por IP)."""
    return servico.enviar(sessao, dados, ip_do_pedido(pedido))


@mensagem_routers.get(
    "", response_model=list[MensagemResposta], dependencies=[Depends(exigir_administrador)]
)
def listar_mensagens(sessao: Session = Depends(obter_sessao)):
    """Mensagens recebidas, das mais recentes para as mais antigas."""
    return servico.listar(sessao)


@mensagem_routers.patch(
    "/{mensagem_id}", response_model=MensagemResposta, dependencies=[Depends(exigir_administrador)]
)
def marcar_mensagem(mensagem_id: int, dados: MensagemEstado, sessao: Session = Depends(obter_sessao)):
    """Marca uma mensagem como lida ou por ler."""
    return servico.marcar(sessao, mensagem_id, dados.lida)
