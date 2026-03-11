# Chess Review Bot (WIP)

A web app that imports public Chess.com games and generates engine-based game reviews (Stockfish planned).

## What it does right now
- FastAPI backend serving a static frontend
- Fetches Chess.com monthly archives for a username
- Lists games for a selected month
- “Analysis mode” UI:
  - chessboard.js board preview
  - move list + clickable navigation
  - moves/info tabs
  - back button to return to archive/game browsing

## Tech Stack
- Python + FastAPI
- Vanilla HTML/CSS/JS
- python-chess (PGN parsing / FEN generation)
- Stockfish (planned, via UCI)

## Run locally
```bash
python -m venv venv

# Windows (PowerShell)
.\venv\Scripts\Activate.ps1

pip install -r backend/requirements.txt
uvicorn backend.main:app --reload
