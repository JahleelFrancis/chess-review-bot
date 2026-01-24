from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi import HTTPException
import httpx

app = FastAPI()

errorDictionary = {
    400: "Bad request. Please check the username.",
    403: "Access forbidden. The user may have a private profile.",
    404: "User not found",
    429: "Rate limit exceeded. Please try again later.",
    500: "Chess.com server error. Please try again later.",
    502: "Bad gateway. Please try again later.",
    503: "Service unavailable. Please try again later.",
    504: "Gateway timeout. Please try again later."
}

@app.get("/api/chesscom/{username}/archives")
async def get_chesscom_archives(username: str):
    chesscom_url = f"https://api.chess.com/pub/player/{username}/games/archives"
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(chesscom_url)
            response.raise_for_status()
            data = response.json()
            return data
        
    except httpx.HTTPError as e:
        status_code = e.response.status_code if e.response else 502
        if status_code >= 500:
            status_code = 502
        error_message = errorDictionary.get(status_code, "An unexpected error occurred.")
        raise HTTPException(status_code=status_code, detail=error_message)
    

@app.get("/api/chesscom/{username}/games")
def get_chesscom_games(username: str, archive: str):
    return {"username": username, "archive": archive, "games": [f"dummy-game-from-{archive}-for-{username}"]}

app.mount("/", StaticFiles(directory="static", html=True), name="static")
