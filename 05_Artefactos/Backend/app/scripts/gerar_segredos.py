"""Gera os segredos do backend numa pasta (que NÃO deve ir para o git):

    jwt_private.pem   chave privada RSA 2048 (assina os tokens)
    jwt_public.pem    chave pública (valida os tokens)
    totp_key.txt      chave AES-256 em base64 (cifra os segredos TOTP na BD)

Uso:  python -m app.scripts.gerar_segredos <pasta> [--forcar]

As duas instâncias do backend têm de usar os MESMOS ficheiros. Gerar chaves novas invalida
todos os tokens emitidos e torna ilegíveis os segredos TOTP já guardados.
"""
import base64
import os
import sys
from pathlib import Path

from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa


def gerar(pasta: Path, forcar: bool = False) -> None:
    pasta.mkdir(parents=True, exist_ok=True)
    ficheiros = [pasta / "jwt_private.pem", pasta / "jwt_public.pem", pasta / "totp_key.txt"]
    existentes = [f.name for f in ficheiros if f.exists()]
    if existentes and not forcar:
        print(f"Já existem {existentes} em {pasta}. Nada alterado (use --forcar para substituir).")
        return
    chave = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    ficheiros[0].write_bytes(chave.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                                 serialization.NoEncryption()))
    ficheiros[1].write_bytes(chave.public_key().public_bytes(serialization.Encoding.PEM,
                                                             serialization.PublicFormat.SubjectPublicKeyInfo))
    ficheiros[2].write_text(base64.b64encode(os.urandom(32)).decode() + "\n", encoding="ascii")
    print(f"Segredos gerados em {pasta.resolve()}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    gerar(Path(sys.argv[1]), forcar="--forcar" in sys.argv)
