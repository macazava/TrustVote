import uvicorn
from fastapi import FastAPI

app = FastAPI()

from app.routers.auth_routes import auth_router
from app.routers.order_routes import order_router

app.include_router(auth_router)
app.include_router(order_router)

@app.get("/")
def oi_trustvote() -> dict:
    return {"message": "TrustVote API está a correr!"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001
                )