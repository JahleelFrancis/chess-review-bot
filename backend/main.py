import asyncio
import io
import csv
import re
from pathlib import Path
import json
import chess
import chess.engine
import chess.pgn
import httpx
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

app = FastAPI()

STOCKFISH_PATH = "stockfish/stockfish-windows-x86-64-avx2/stockfish/stockfish-windows-x86-64-avx2.exe"
ENGINE_DEPTH = 12
ENGINE_MULTIPV = 3
STATIC_DIR = Path(__file__).resolve().parent.parent / "static"
OPENINGS_DIR = Path(__file__).resolve().parent / "openings"
OPENING_BOOK = {}

CHESSCOM_HEADERS = {
    "User-Agent": "ChessReviewBot/1.0 (local development; contact: jahleel.francis@gmail.com)"
}

app.mount("/vendor", StaticFiles(directory=STATIC_DIR / "vendor"), name="vendor")
app.mount("/img", StaticFiles(directory=STATIC_DIR / "img"), name="img")


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
    504: "Gateway timeout. Please try again later.",
}


def normalize_username(username: str) -> str:
    if username is None or username.strip() == "":
        raise HTTPException(status_code=400, detail="Username cannot be empty.")

    return username.strip().lower()


def score_to_dict(score):
    score = score.white()

    if score.is_mate():
        return {
            "type": "mate",
            "value": score.mate(),
        }

    return {
        "type": "cp",
        "value": score.score(mate_score=100000),
    }


def fen_key(value) -> str:
    """
    Normalize a FEN for opening lookup.

    Keep:
    - piece placement
    - side to move
    - castling rights
    - en-passant square

    Ignore:
    - halfmove clock
    - fullmove number
    """
    if isinstance(value, chess.Board):
        fen = value.fen()
    else:
        fen = str(value or "")

    return " ".join(fen.split(" ")[:4])


def strip_pgn_noise(text: str) -> str:
    """Remove comments, variations, NAGs, and result markers from a PGN move line."""
    text = str(text or "")

    # Remove comments: { ... }
    text = re.sub(r"\{[^}]*\}", " ", text)

    # Remove simple parenthesized variations. Repeat to handle nested-ish data decently.
    previous = None
    while previous != text:
        previous = text
        text = re.sub(r"\([^()]*\)", " ", text)

    # Remove NAGs like $1, $14, etc.
    text = re.sub(r"\$\d+", " ", text)

    # Remove move numbers like 1. or 1... or 23...
    text = re.sub(r"\b\d+\.{1,3}", " ", text)

    # Remove common result markers.
    text = re.sub(r"\b(1-0|0-1|1/2-1/2|\*)\b", " ", text)

    return " ".join(text.split())


def parse_move_token(board: chess.Board, token: str) -> chess.Move | None:
    """Parse one move token as SAN first, then UCI as a fallback."""
    token = str(token or "").strip()

    if not token:
        return None

    # Remove trailing annotations while keeping check/mate markers mostly intact.
    token = token.rstrip("!?∞⩲⩱±∓+-")

    if not token:
        return None

    try:
        return board.parse_san(token)
    except ValueError:
        pass

    try:
        move = chess.Move.from_uci(token)

        if move in board.legal_moves:
            return move
    except ValueError:
        pass

    return None


def parse_opening_line_to_moves(move_text: str) -> list[chess.Move]:
    """
    Convert a PGN/SAN/UCI opening line into a list of legal chess.Move objects.

    This is more reliable than only using chess.pgn.read_game because many
    opening datasets store lines without headers or with lightweight annotations.
    """
    raw = str(move_text or "").strip()

    if not raw:
        return []

    # First try python-chess PGN parsing. This handles normal PGN lines well.
    try:
        game = chess.pgn.read_game(io.StringIO(raw + " *"))

        if game is not None:
            moves = list(game.mainline_moves())

            if moves:
                return moves
    except Exception:
        pass

    board = chess.Board()
    parsed_moves = []
    cleaned = strip_pgn_noise(raw)

    for token in cleaned.split():
        move = parse_move_token(board, token)

        if move is None:
            continue

        parsed_moves.append(move)
        board.push(move)

    return parsed_moves


def add_book_move(book: dict, board: chess.Board, move: chess.Move, name=None, eco=None):
    """Add one legal book continuation from the current board position."""
    key = fen_key(board)

    if key not in book:
        book[key] = {
            "opening_name": None,
            "eco": None,
            "moves": set(),
            "depth": -1,
        }

    book[key]["moves"].add(move.uci())

    # Name deeper positions first. Avoid labeling the starting position as one
    # random opening just because it appears in many lines.
    depth = board.ply()

    if depth >= 2 and depth >= book[key]["depth"]:
        if name:
            book[key]["opening_name"] = name

        if eco:
            book[key]["eco"] = eco

        book[key]["depth"] = depth


def add_opening_line(book: dict, move_text: str, name=None, eco=None):
    """Add every prefix position from an opening line to the local book tree."""
    board = chess.Board()
    moves = parse_opening_line_to_moves(move_text)

    for move in moves:
        if move not in board.legal_moves:
            break

        add_book_move(book, board, move, name=name, eco=eco)
        board.push(move)


def add_position_moves(book: dict, fen: str, moves, name=None, eco=None):
    """Add candidate book moves from a row/object that already supplies a FEN."""
    try:
        board = chess.Board(fen)
    except Exception:
        return

    if isinstance(moves, str):
        # Accept either comma-separated or whitespace-separated move lists.
        raw_moves = re.split(r"[,\s]+", moves.strip())
    else:
        raw_moves = moves or []

    for item in raw_moves:
        if isinstance(item, dict):
            move_text = item.get("uci") or item.get("move") or item.get("san")
        else:
            move_text = item

        move = parse_move_token(board, str(move_text or ""))

        if move is None:
            continue

        add_book_move(book, board, move, name=name, eco=eco)


def row_get(row: dict, *names):
    """Case-insensitive row getter for CSV/TSV/JSON opening data."""
    lowered = {str(k).lower(): v for k, v in row.items()}

    for name in names:
        value = lowered.get(str(name).lower())

        if value not in (None, ""):
            return value

    return None


def load_opening_file_into_book(book: dict, path: Path):
    suffix = path.suffix.lower()

    if suffix in {".tsv", ".csv"}:
        delimiter = "\t" if suffix == ".tsv" else ","

        with path.open("r", encoding="utf-8-sig", newline="") as f:
            reader = csv.DictReader(f, delimiter=delimiter)

            for row in reader:
                eco = row_get(row, "eco", "ECO")
                name = row_get(row, "name", "Name", "opening", "Opening")
                fen = row_get(row, "fen", "FEN")
                moves = row_get(row, "moves", "Moves", "move", "Move")
                pgn = row_get(row, "pgn", "PGN", "line", "Line", "variation", "Variation")

                if fen and moves:
                    add_position_moves(book, fen, moves, name=name, eco=eco)

                if pgn:
                    add_opening_line(book, pgn, name=name, eco=eco)
                elif moves and not fen:
                    add_opening_line(book, moves, name=name, eco=eco)

        return

    if suffix == ".json":
        with path.open("r", encoding="utf-8") as f:
            data = json.load(f)

        if isinstance(data, dict):
            # Format A: {fenKey: {moves: [...]}}
            # Format B: {fenKey: [moves...]}
            for key, value in data.items():
                if isinstance(value, dict):
                    name = value.get("opening_name") or value.get("name")
                    eco = value.get("eco")
                    moves = value.get("moves", [])
                    add_position_moves(book, key, moves, name=name, eco=eco)
                elif isinstance(value, list):
                    add_position_moves(book, key, value)

            return

        if isinstance(data, list):
            for row in data:
                if not isinstance(row, dict):
                    continue

                eco = row_get(row, "eco", "ECO")
                name = row_get(row, "name", "Name", "opening", "Opening")
                fen = row_get(row, "fen", "FEN")
                moves = row_get(row, "moves", "Moves", "move", "Move")
                pgn = row_get(row, "pgn", "PGN", "line", "Line", "variation", "Variation")

                if fen and moves:
                    add_position_moves(book, fen, moves, name=name, eco=eco)

                if pgn:
                    add_opening_line(book, pgn, name=name, eco=eco)
                elif moves and not fen:
                    add_opening_line(book, moves, name=name, eco=eco)


def load_opening_book():
    book = {}

    if not OPENINGS_DIR.exists():
        print("Opening folder not found:", OPENINGS_DIR)
        return book

    for path in sorted(OPENINGS_DIR.glob("*")):
        if path.suffix.lower() not in {".tsv", ".csv", ".json"}:
            continue

        try:
            load_opening_file_into_book(book, path)
        except Exception as e:
            print(f"Could not load opening file {path.name}: {e!r}")

    # Convert sets to sorted lists for JSON serialization.
    cleaned_book = {}

    for key, data in book.items():
        cleaned_book[key] = {
            "opening_name": data.get("opening_name"),
            "eco": data.get("eco"),
            "moves": sorted(data.get("moves", set())),
        }

    print(f"Loaded {len(cleaned_book)} opening positions.")
    return cleaned_book


OPENING_BOOK = load_opening_book()


@app.get("/api/chesscom/{username}/archives")
async def get_chesscom_archives(username: str):
    username = normalize_username(username)
    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"

    try:
        async with httpx.AsyncClient(timeout=20.0, headers=CHESSCOM_HEADERS) as client:
            archives_response = await client.get(archives_url)
            archives_response.raise_for_status()
            archives_data = archives_response.json()

            archives = archives_data.get("archives", [])
            canonical_username = username

            if archives:
                newest_archive_url = archives[-1]
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
                "archives": archives,
            }

    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code

        if status_code >= 500:
            status_code = 502

        error_message = errorDictionary.get(status_code, "An unexpected error occurred.")
        raise HTTPException(status_code=status_code, detail=error_message)

    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach Chess.com API.")


@app.get("/api/chesscom/{username}/games")
async def get_chesscom_games(username: str, archive: str):
    username = normalize_username(username)

    archive_parts = archive.split("/")

    if len(archive_parts) != 2:
        raise HTTPException(status_code=400, detail="Invalid archive format. Use 'YYYY/MM'.")

    year, month = archive_parts

    if not (year.isdigit() and len(year) == 4):
        raise HTTPException(status_code=400, detail="Invalid year. Use YYYY.")

    if not (month.isdigit() and len(month) == 2 and 1 <= int(month) <= 12):
        raise HTTPException(status_code=400, detail="Invalid month. Use MM (01-12).")

    chesscom_url = f"https://api.chess.com/pub/player/{username}/games/{year}/{month}"

    try:
        async with httpx.AsyncClient(timeout=20.0, headers=CHESSCOM_HEADERS) as client:
            response = await client.get(chesscom_url)
            response.raise_for_status()
            return response.json()

    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code

        if status_code >= 500:
            status_code = 502

        error_message = errorDictionary.get(status_code, "An unexpected error occurred.")
        raise HTTPException(status_code=status_code, detail=error_message)

    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach Chess.com API.")


def engine_info_to_dict(info):
    if isinstance(info, dict):
        pv = info.get("pv", [])
        score_data = score_to_dict(info["score"])

        return {
            **score_data,
            "best_move": pv[0].uci() if pv else None,
            "pv": [move.uci() for move in pv[:5]],
        }

    lines = []

    for line in info:
        pv = line.get("pv", [])
        score_data = score_to_dict(line["score"])

        lines.append({
            **score_data,
            "best_move": pv[0].uci() if pv else None,
            "pv": [move.uci() for move in pv[:5]],
            "multipv": line.get("multipv"),
        })

    primary = lines[0] if lines else {
        "type": "cp",
        "value": 0,
        "best_move": None,
        "pv": [],
    }

    return {
        **primary,
        "lines": lines,
    }


def get_game_id_from_url(url: str) -> str | None:
    if not url:
        return None

    return url.rstrip("/").split("/")[-1]


@app.get("/api/chesscom/{username}/game/{game_id}")
async def get_chesscom_game_by_id(username: str, game_id: str):
    username = normalize_username(username)

    archives_url = f"https://api.chess.com/pub/player/{username}/games/archives"

    try:
        async with httpx.AsyncClient(timeout=20.0, headers=CHESSCOM_HEADERS) as client:
            archives_response = await client.get(archives_url)
            archives_response.raise_for_status()
            archives_data = archives_response.json()

            archives = archives_data.get("archives", [])

            # Newest first.
            for archive_url in reversed(archives):
                games_response = await client.get(archive_url)
                games_response.raise_for_status()
                games_data = games_response.json()

                for game in games_data.get("games", []):
                    current_id = get_game_id_from_url(game.get("url", ""))

                    if current_id == game_id:
                        return {
                            "game": game,
                            "archive": "/".join(archive_url.rstrip("/").split("/")[-2:]),
                        }

            raise HTTPException(status_code=404, detail="Game not found.")

    except HTTPException:
        raise

    except httpx.HTTPStatusError as e:
        status_code = e.response.status_code

        if status_code >= 500:
            status_code = 502

        error_message = errorDictionary.get(status_code, "An unexpected error occurred.")
        raise HTTPException(status_code=status_code, detail=error_message)

    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="Could not reach Chess.com API.")


@app.post("/api/analyze")
async def analyze_game(request: PGNData):
    if not request.pgn or request.pgn.strip() == "":
        raise HTTPException(status_code=400, detail="PGN data cannot be empty.")

    game = chess.pgn.read_game(io.StringIO(request.pgn))

    if game is None:
        raise HTTPException(status_code=400, detail="Invalid PGN format.")

    board = game.board()
    moves = list(game.mainline_moves())

    def run_engine():
        moves_san = []
        uci_moves = []
        fens = [board.fen()]
        evaluations = []
        engine = None

        try:
            engine = chess.engine.SimpleEngine.popen_uci(STOCKFISH_PATH)

            info = engine.analyse(
                board,
                chess.engine.Limit(depth=ENGINE_DEPTH),
                multipv=ENGINE_MULTIPV,
            )
            evaluations.append(engine_info_to_dict(info))

            for move in moves:
                moves_san.append(board.san(move))
                uci_moves.append(move.uci())

                board.push(move)
                fens.append(board.fen())

                info_after = engine.analyse(
                    board,
                    chess.engine.Limit(depth=ENGINE_DEPTH),
                    multipv=ENGINE_MULTIPV,
                )
                evaluations.append(engine_info_to_dict(info_after))

        finally:
            if engine is not None:
                engine.quit()

        return {
            "moves": moves_san,
            "uci_moves": uci_moves,
            "fens": fens,
            "evaluations": evaluations,
        }

    return await asyncio.to_thread(run_engine)


@app.get("/api/opening")
async def get_opening_data(fen: str):
    try:
        board = chess.Board(fen)
        key = fen_key(board)
        data = OPENING_BOOK.get(key)

        if not data:
            return {
                "opening_name": None,
                "eco": None,
                "moves": [],
            }

        return {
            "opening_name": data.get("opening_name"),
            "eco": data.get("eco"),
            "moves": data.get("moves", []),
        }

    except Exception as e:
        return {
            "opening_name": None,
            "eco": None,
            "moves": [],
            "error": repr(e),
        }


@app.get("/")
async def serve_index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/styles.css")
async def serve_styles():
    return FileResponse(STATIC_DIR / "styles.css")


@app.get("/app.js")
async def serve_app_js():
    return FileResponse(STATIC_DIR / "app.js")


@app.get("/api.js")
async def serve_api_js():
    return FileResponse(STATIC_DIR / "api.js")


@app.get("/ui.js")
async def serve_ui_js():
    return FileResponse(STATIC_DIR / "ui.js")


@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="Not found")

    return FileResponse(STATIC_DIR / "index.html")