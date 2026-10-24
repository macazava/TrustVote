from fastapi import APIRouter
from pydantic import BaseModel
auth_routers = APIRouter(prefix="/auth", tags=["auth"])
async def home():
    """Endpoint para a página inicial."""
    return {"message": "Bem-vindo à página inicial"}    
@auth_routers.get("/")
async def home():
    """Endpoint para a página inicial."""
    return {"message": "Bem-vindo à página inicial"}    

@auth_routers.post("/login")     
async def login():
    """Endpoint para o login."""
    return {"message": "Login realizado com sucesso"}    
@auth_routers.post("/register")
async def register():
    """Endpoint para o registro."""
    return {"message": "Registro realizado com sucesso"}    

@auth_routers.post("/logout")
async def logout():
    """Endpoint para o logout."""
    return {"message": "Logout realizado com sucesso"}    
@auth_routers.post("/reset-password")
async def reset_password():
    """Endpoint para a resetação de senha."""
    return {"message": "Registro realizado com sucesso"}    
@auth_routers.post("/verify-password")
async def verify_password():
    """Endpoint para a verificação de senha."""
    return {"message": "Verificação de senha realizada com sucesso"}    


