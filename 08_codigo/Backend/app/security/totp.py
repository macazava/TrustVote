"""Códigos TOTP (RFC 6238) da autenticação de dois fatores.

Só trata da parte criptográfica — gerar o segredo, montar o URI que as
aplicações autenticadoras leem como código QR e confirmar um código. As regras
de negócio (quando ativar/desativar) ficam no serviço de autenticação.
"""

import pyotp

# O nome que aparece na aplicação autenticadora.
EMISSOR = "TrustVote"

# Tolera um passo de relógio para cada lado (30 s), para pequenas diferenças
# entre o relógio do telemóvel e o do servidor.
JANELA_VALIDACAO = 1

# Tamanho do segredo partilhado, em caracteres base32.
CARACTERES_SEGREDO = 32


def gerar_segredo() -> str:
    """Cria um segredo base32 novo, pronto a ser lido por uma aplicação autenticadora."""
    return pyotp.random_base32(length=CARACTERES_SEGREDO)


def montar_uri(segredo: str, conta: str) -> str:
    """Devolve o URI `otpauth://` que o frontend desenha como código QR."""
    return pyotp.TOTP(segredo).provisioning_uri(
        name=conta, issuer_name=EMISSOR
    )


def verificar_codigo(segredo: str, codigo: str) -> bool:
    """Confirma se o código de 6 dígitos é válido para o segredo dado."""
    return pyotp.TOTP(segredo).verify(codigo, valid_window=JANELA_VALIDACAO)
