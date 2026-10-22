import uvicorn
from fastapi import FastAPI

app = FastAPI()

@app.get("/")
def oi_trustvote() -> dict:
    return {"message": "TrustVote API está a correr!"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001
                )