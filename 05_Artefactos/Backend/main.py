import uvicorn
from fastapi import FastAPI
from app.routers.auth_routers import auth_routers   
from app.routers.order_routers import order_router

app = FastAPI()
app.include_router(auth_routers)
app.include_router(order_router)  



@app.get("/")
def oi_trustvote() -> dict:
    return {"message": "TrustVote API está a correr!"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001
                )