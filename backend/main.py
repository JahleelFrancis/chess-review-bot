from symtable import Class
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi import HTTPException
import httpx
from pydantic import BaseModel

app = FastAPI()

class PGNData(BaseModel):
    pgn: str

errorDictionary = {
    400: "Bad request. Please check the username.",
    403: "Access forbidden. The user may have a private profile.",
    404: "No games found for that archive or user does not exist.",
    429: "Rate limit exceeded. Please try again later.",
    500: "Chess.com server error. Please try again later.",
    502: "Bad gateway. Please try again later.",
    503: "Service unavailable. Please try again later.",
    504: "Gateway timeout. Please try again later."
}

def normalize_username(username: str) -> str:
    if username is None or username.strip() == "":
        raise HTTPException(status_code=400, detail="Username cannot be empty.")
    return username.strip().lower()

@app.get("/api/chesscom/{username}/archives")
async def get_chesscom_archives(username: str):
    username = normalize_username(username)
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
async def get_chesscom_games(username: str, archive: str):
    username = normalize_username(username)
    
    archive_parts = archive.split('/')
    if len(archive_parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid archive format. Use 'YYYY/MM'.")
    
    year, month = archive_parts
    if not (year.isdigit() and len(year) == 4):
        raise HTTPException(400, "Invalid year. Use YYYY.")
    
    if not (month.isdigit() and len(month) == 2 and 1 <= int(month) <= 12):
        raise HTTPException(400, "Invalid month. Use MM (01-12).")
    
    chesscom_url = f"https://api.chess.com/pub/player/{username}/games/{year}/{month}"

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

@app.post("/api/analyze")
async def analyze_game(response: PGNData):
    if not response.pgn or response.pgn.strip() == "":
        raise HTTPException(status_code=400, detail="PGN data cannot be empty.")
    
    # Placeholder for analysis logic
    analysis_result = {
        "summary": "Ready to analyze",
        "moves": [],
        "players": {},
        "results": {},
        "details": {}
    }
    
    return analysis_result

app.mount("/", StaticFiles(directory="static", html=True), name="static")
