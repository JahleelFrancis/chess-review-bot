from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()

@app.get("/api/chesscom/{username}/archives")
def get_chesscom_archives(username: str):
    return {"archives": [f"dummy-archive-for-{username}"]}

app.mount("/", StaticFiles(directory="static", html=True), name="static")
