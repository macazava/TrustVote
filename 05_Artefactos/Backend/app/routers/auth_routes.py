from fastapi import APIRouter

auth_router = APIRouter(prefix="/auth", tags=["auth"])

@auth_router.get("/")
async def autenticar():
    """
    Essa é a rota padrão de autenticação. Ela retorna uma mensagem indicando que o utilizador acessou a rota de autenticação, mas não está autenticado.
    :return:
    """
    return {"message": "Você acessou a rota padrão de autenticação.", "autenticado": False }


dominio = "http://localhost:8001"
