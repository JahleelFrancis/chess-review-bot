# Chess Review Bot (WIP)

Web app that imports public Chess.com games and generates engine-based game reviews using Stockfish.

## Current Features
- FastAPI backend serving a static frontend
- Frontend calls backend API endpoints with vanilla JS
- Git repo set up with proper ignores

## Planned Features
- Import games by Chess.com username (monthly archives)
- Select a game and display PGN + moves
- Stockfish analysis (eval + best line per move)
- Move classification (best/good/inaccuracy/mistake/blunder)
- Key moments + basic accuracy score
- UI upgrade (board view, arrows, nicer review page)

## Tech Stack
- Python, FastAPI
- Vanilla HTML/CSS/JS
- python-chess + Stockfish (UCI)

## Run Locally
```bash
python -m venv venv
venv\Scripts\activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
