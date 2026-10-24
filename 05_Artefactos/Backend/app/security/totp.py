"""TOTP (autenticação de dois fatores, RFC 6238) com o segredo guardado cifrado.

O segredo de cada utilizador é cifrado com AES-256-GCM antes de ir para a BD, com a chave
TOTP_ENCRYPTION_KEY (32 bytes em base64). Uma cópia da BD sem essa chave não permite gerar códigos.
"""
import base64
import hmac
import os
import time

import pyotp
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.config import get_settings

PERIODO = 30          # segundos por código
JANELA = 1            # aceita o passo anterior/seguinte (relógios ligeiramente dessincronizados)
_AAD = b"trustvote-totp-v1"


def _aesgcm() -> AESGCM:
    chave = base64.b64decode(get_settings().totp_encryption_key)
    if len(chave) != 32:
        raise RuntimeError("TOTP_ENCRYPTION_KEY tem de ter 32 bytes (base64)")
    return AESGCM(chave)


def gerar_segredo() -> str:
    return pyotp.random_base32()


def cifrar(segredo: str) -> str:
    nonce = os.urandom(12)
    return base64.b64encode(nonce + _aesgcm().encrypt(nonce, segredo.encode(), _AAD)).decode()


def decifrar(segredo_cifrado: str) -> str:
    dados = base64.b64decode(segredo_cifrado)
    return _aesgcm().decrypt(dados[:12], dados[12:], _AAD).decode()


def uri_provisionamento(segredo: str, email: str) -> str:
    """URI otpauth:// para gerar o QR code na app autenticadora (Google Authenticator, etc.)."""
    return pyotp.TOTP(segredo, interval=PERIODO).provisioning_uri(name=email, issuer_name=get_settings().totp_issuer)


def verificar_codigo(segredo: str, codigo: str, ultimo_passo: int | None, agora: float | None = None) -> int | None:
    """Devolve o passo de tempo do código se for válido e ainda não usado; senão None.

    Guardar o passo devolvido em ut_totp_ultimo_passo impede reutilizar o mesmo código
    (replay), mesmo que o segundo pedido chegue à outra instância do backend.
    """
    if not codigo or not codigo.isdigit():
        return None
    totp = pyotp.TOTP(segredo, interval=PERIODO)
    passo_atual = int((agora if agora is not None else time.time()) // PERIODO)
    for passo in range(passo_atual - JANELA, passo_atual + JANELA + 1):
        if ultimo_passo is not None and passo <= ultimo_passo:
            continue
        if hmac.compare_digest(totp.at(passo * PERIODO), codigo):
            return passo
    return None
