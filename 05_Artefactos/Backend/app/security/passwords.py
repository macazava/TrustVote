"""Hash de passwords com Argon2 (pwdlib)."""
from pwdlib import PasswordHash
from pwdlib.hashers.argon2 import Argon2Hasher

_hasher = PasswordHash((Argon2Hasher(),))

# Hash de uma password aleatória: usado quando o email não existe, para o login demorar
# o mesmo tempo e não revelar que contas existem (enumeração de utilizadores).
_HASH_FICTICIO = _hasher.hash("password-ficticia-para-tempo-constante")


def gerar_hash(password: str) -> str:
    return _hasher.hash(password)


def verificar(password: str, password_hash: str | None) -> bool:
    if password_hash is None:
        _hasher.verify(password, _HASH_FICTICIO)
        return False
    return _hasher.verify(password, password_hash)
