from fastapi import APIRouter
from models import utilizador, trustvote
from sqlalchemy.orm import sessionmaker

autenticacao_router = APIRouter(prefix="/autenticacao", tags=["autenticacao"])

@autenticacao_router.get("/")
async def home():
    """Endpoint para a página inicial."""
    return {"message": "Bem-vindo à página inicial"}

@autenticacao_router.post("/criar_conta")
async def criar_conta(email: str, senha: str):
    Session = sessionmaker(bind=trustvote)
    session = Session()
    utilizador = session.query(utilizador).filter(utilizador.email == email).first()
    if utilizador:
        return {"message": "O utilizador já existe."}
    novo_utilizador = utilizador(email=email, senha=senha)
    session.add(novo_utilizador)
    session.commit()
    return {"message": "Conta criada com sucesso."}


