from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

app = FastAPI()

# Serve the frontend (we'll add HTML next)
app.mount("/", StaticFiles(directory="static", html=True), name="static")
