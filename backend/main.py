import asyncio
import io
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi import HTTPException
import httpx
from pydantic import BaseModel
import chess
import chess.pgn

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

# The chess.com API endpoint for fetching archives is /pub/player/{username}/games/archives
@app.get("/api/chesscom/{username}/archives")
async def get_chesscom_archives(username: str):
    username = normalize_username(username)

    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            archives_response = await client.get(archives_url)
            archives_response.raise_for_status()
            archives_data = archives_response.json()

            archives = archives_data.get("archives", [])
            canonical_username = username

            # Try to resolve the real Chess.com capitalization immediately
            if archives:
                newest_archive_url = archives[-1]  # Chess.com returns oldest -> newest
                games_response = await client.get(newest_archive_url)
                games_response.raise_for_status()
                games_data = games_response.json()

                for game in games_data.get("games", []):
                    white_username = game.get("white", {}).get("username", "")
                    black_username = game.get("black", {}).get("username", "")

                    if white_username.lower() == username:
                        canonical_username = white_username
                        break

                    if black_username.lower() == username:
                        canonical_username = black_username
                        break

            return {
                "username": canonical_username,
                "archives": archives
            }

    except httpx.HTTPError as e:
        status_code = e.response.status_code if e.response else 502
        if status_code >= 500:
            status_code = 502
        error_message = errorDictionary.get(
            status_code, "An unexpected error occurred."
        )
        raise HTTPException(status_code=status_code, detail=error_message)
    
# The chess.com API endpoint for fetching games by month is /pub/player/{username}/games/{YYYY}/{MM}
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

# This endpoint accepts PGN data, parses it, and returns an analysis of the game.
@app.post("/api/analyze")
async def analyze_game(response: PGNData):
    if not response.pgn or response.pgn.strip() == "":
        raise HTTPException(status_code=400, detail="PGN data cannot be empty.")
    
    game = chess.pgn.read_game(io.StringIO(response.pgn))
    if game is None:
        raise HTTPException(status_code=400, detail="Invalid PGN format.")
    
    board = game.board()
    moves = list(game.mainline_moves())
    moves_san = []
    fens = [board.fen()]
    move_count = 0
    
    for move in moves:
        moves_san.append(board.san(move))
        board.push(move)
        fens.append(board.fen())
        move_count += 1

    analysis_result = {
        "fens": fens,
        "moves": moves_san
    }
    
    return analysis_result

app.mount("/", StaticFiles(directory="static", html=True), name="static")