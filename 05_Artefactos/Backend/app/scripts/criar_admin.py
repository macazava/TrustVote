"""Cria (ou promove) um administrador. O registo público só cria eleitores.

Uso:  python -m app.scripts.criar_admin <email> <nome>
      A password é pedida no terminal, ou lida de ADMIN_PASSWORD (para scripts/Docker).

No Docker:
      docker compose exec servidor1 python -m app.scripts.criar_admin admin@trustvote.pt "Administrador"
"""
import getpass
import os
import sys

from app.database import get_session_factory
from app.models.utilizador import PERFIL_ADMIN
from app.repositories import utilizador as repo
from app.services import autenticacao
from app.services.erros import ErroNegocio


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit(__doc__)
    email, nome = sys.argv[1], sys.argv[2]
    with get_session_factory()() as db:
        existente = repo.por_email(db, email)
        if existente:
            existente.perfil = PERFIL_ADMIN
            existente.ativo = True
            db.commit()
            print(f"Utilizador {email} (id {existente.id}) promovido a administrador.")
            return
        password = os.getenv("ADMIN_PASSWORD") or getpass.getpass("Password do administrador: ")
        if len(password) < 8:
            sys.exit("A password tem de ter pelo menos 8 caracteres.")
        try:
            u = autenticacao.registar(db, nome, email, password, perfil=PERFIL_ADMIN)
        except ErroNegocio as e:
            sys.exit(e.mensagem)
        print(f"Administrador {u.email} criado (id {u.id}).")


if __name__ == "__main__":
    main()
