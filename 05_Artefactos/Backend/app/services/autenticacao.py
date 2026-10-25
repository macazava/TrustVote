"""Registo, login, TOTP e gestão de utilizadores/permissões (RF01, RF02)."""
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.models import Utilizador
from app.models.utilizador import PERFIL_ADMIN, PERFIL_ELEITOR
from app.repositories import utilizador as repo
from app.security import passwords, tokens, totp
from app.services import auditoria
from app.services.erros import Conflito, DadosInvalidos, NaoAutorizado, NaoEncontrado, Proibido

MSG_LOGIN_INVALIDO = "Email ou password inválidos"


def registar(db: Session, nome: str, email: str, password: str, *, perfil: str = PERFIL_ELEITOR,
             ip: str | None = None) -> Utilizador:
    """Cria uma conta. Pelo registo público só se criam eleitores; admins são criados por script
    (app/scripts/criar_admin.py) ou promovidos por outro admin."""
    if repo.por_email(db, email):
        raise Conflito("Já existe uma conta com este email")
    utilizador = Utilizador(nome=nome, email=email.lower(), password_hash=passwords.gerar_hash(password),
                            perfil=perfil)
    db.add(utilizador)
    try:
        db.flush()
    except IntegrityError:  # dois registos simultâneos com o mesmo email
        db.rollback()
        raise Conflito("Já existe uma conta com este email")
    auditoria.registar(db, "utilizador.registo", utilizador_id=utilizador.id, entidade="utilizador",
                       entidade_id=utilizador.id, ip=ip)
    db.commit()
    return utilizador


def login(db: Session, email: str, password: str, codigo_totp: str | None, *, ip: str | None = None) -> tuple[str, int]:
    utilizador = repo.por_email(db, email)
    password_ok = passwords.verificar(password, utilizador.password_hash if utilizador else None)

    if not utilizador or not password_ok or not utilizador.ativo:
        auditoria.registar(db, "auth.login_falhado", utilizador_id=utilizador.id if utilizador else None,
                           detalhes={"motivo": "credenciais" if not password_ok else "conta_inativa"}, ip=ip)
        db.commit()
        # mesma mensagem em todos os casos: não revela se o email existe nem se a conta está inativa
        raise NaoAutorizado(MSG_LOGIN_INVALIDO)

    if utilizador.totp_ativo:
        if not codigo_totp:
            raise NaoAutorizado("Código TOTP necessário")
        # bloqueia a linha: dois logins simultâneos com o mesmo código (em instâncias diferentes)
        # não podem ambos ser aceites
        utilizador = repo.por_id(db, utilizador.id, bloquear=True)
        passo = totp.verificar_codigo(totp.decifrar(utilizador.totp_segredo), codigo_totp,
                                      utilizador.totp_ultimo_passo)
        if passo is None:
            db.rollback()
            auditoria.registar(db, "auth.login_falhado", utilizador_id=utilizador.id,
                               detalhes={"motivo": "totp"}, ip=ip)
            db.commit()
            raise NaoAutorizado("Código TOTP inválido")
        utilizador.totp_ultimo_passo = passo

    token = tokens.criar_token(utilizador.id, utilizador.perfil)
    auditoria.registar(db, "auth.login", utilizador_id=utilizador.id, ip=ip)
    db.commit()
    return token


def configurar_totp(db: Session, utilizador: Utilizador) -> tuple[str, str]:
    """Gera um segredo novo (ainda inativo). Só fica ativo depois de confirmado com um código."""
    if utilizador.totp_ativo:
        raise Conflito("O TOTP já está ativo; desative-o primeiro")
    segredo = totp.gerar_segredo()
    utilizador.totp_segredo = totp.cifrar(segredo)
    utilizador.totp_ultimo_passo = None
    db.commit()
    return segredo, totp.uri_provisionamento(segredo, utilizador.email)


def _validar_codigo(db: Session, utilizador: Utilizador, codigo: str) -> None:
    if not utilizador.totp_segredo:
        raise Conflito("O TOTP não foi configurado")
    passo = totp.verificar_codigo(totp.decifrar(utilizador.totp_segredo), codigo, utilizador.totp_ultimo_passo)
    if passo is None:
        raise DadosInvalidos("Código TOTP inválido")
    utilizador.totp_ultimo_passo = passo


def ativar_totp(db: Session, utilizador: Utilizador, codigo: str, *, ip: str | None = None) -> None:
    if utilizador.totp_ativo:
        raise Conflito("O TOTP já está ativo")
    _validar_codigo(db, utilizador, codigo)
    utilizador.totp_ativo = True
    auditoria.registar(db, "auth.totp_ativado", utilizador_id=utilizador.id, ip=ip)
    db.commit()


def desativar_totp(db: Session, utilizador: Utilizador, codigo: str, *, ip: str | None = None) -> None:
    if not utilizador.totp_ativo:
        raise Conflito("O TOTP não está ativo")
    _validar_codigo(db, utilizador, codigo)
    utilizador.totp_ativo = False
    utilizador.totp_segredo = None
    auditoria.registar(db, "auth.totp_desativado", utilizador_id=utilizador.id, ip=ip)
    db.commit()


def atualizar_utilizador(db: Session, admin: Utilizador, utilizador_id: int, *, perfil: str | None,
                         ativo: bool | None) -> Utilizador:
    """Um admin muda o perfil ou ativa/desativa contas. Não se pode despromover/desativar a si próprio
    (evita ficar o sistema sem nenhum administrador por engano)."""
    alvo = repo.por_id(db, utilizador_id, bloquear=True)
    if alvo is None:
        raise NaoEncontrado("Utilizador não encontrado")
    if alvo.id == admin.id and (perfil not in (None, PERFIL_ADMIN) or ativo is False):
        raise Proibido("Não pode retirar o seu próprio acesso de administrador")
    alteracoes = {}
    if perfil is not None and perfil != alvo.perfil:
        alteracoes["perfil"] = [alvo.perfil, perfil]
        alvo.perfil = perfil
    if ativo is not None and ativo != alvo.ativo:
        alteracoes["ativo"] = [alvo.ativo, ativo]
        alvo.ativo = ativo
    if alteracoes:
        auditoria.registar(db, "utilizador.atualizado", utilizador_id=admin.id, entidade="utilizador",
                           entidade_id=alvo.id, detalhes=alteracoes)
    db.commit()
    return alvo
