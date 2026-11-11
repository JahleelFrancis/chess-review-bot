# Chess Review Bot ♟️

A locally run chess game-review web app that imports public [Chess.com](https://www.chess.com/) games and analyzes them with [Stockfish](https://stockfishchess.org/). Browse your game history, step through positions, examine move-quality estimates, and explore tactical ideas on an interactive board.

> **Status: active development.** This is an independent project, not an official Chess.com product. Move classifications, accuracy, estimated game ratings, and generated explanations are approximations—not verified replicas of Chess.com's Game Review.

## Features

- **Chess.com game browser:** enter a username, browse monthly archives, and select a game.
- **Engine-backed review:** replay the complete PGN with Stockfish evaluations and candidate continuations.
- **Interactive analysis board:** move navigation, board orientation, move highlights, evaluation bar, and tactical arrows.
- **Move-by-move feedback:** estimated Best/Excellent/Good and mistake-related classifications, tactical insights, and selected key moments.
- **Review overview:** evaluation timeline, estimated accuracy, performance ratings, and move-quality summaries.
- **Explain mode:** opt into a suggested continuation, step through its legal moves, and return to the original game state with **Got it**.
- **Opening data:** local opening-book lookup alongside engine analysis.
- **Verification harness:** deterministic frontend tests, independent `python-chess` rule checks, and adversarial mutation tests.

## Tech stack

| Component | Technology |
| --- | --- |
| Backend/API | Python, FastAPI, `httpx` |
| Chess rules / PGN | `python-chess` (backend), `chess.js` (frontend) |
| Engine | Stockfish via UCI |
| Frontend | Vanilla JavaScript, HTML, CSS, chessboard.js |
| Testing | Node.js built-in test runner, Python rule oracle; optional Playwright browser checks |

## Run locally (Windows / PowerShell)

### 1. Prerequisites

- Python **3.10+** and a working `pip` installation
- [Stockfish](https://stockfishchess.org/download/) for Windows (the current backend expects the **AVX2** build at the location below)
- Node.js **18+** if you want to run the test harness

Clone the repository and enter its folder:

```powershell
git clone https://github.com/JahleelFrancis/chess-review-bot.git
cd chess-review-bot
```

The current backend has a Windows-specific Stockfish path in `backend/main.py`. It expects:

```text
stockfish/stockfish-windows-x86-64-avx2/stockfish/stockfish-windows-x86-64-avx2.exe
```

Download the compatible engine and place the executable there, or update `STOCKFISH_PATH` in `backend/main.py` for your local installation. The binary is not necessarily distributed with the Git repository; the project ignores `*.exe` files.

### 2. Set up Python

```powershell
py -3 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install fastapi uvicorn python-chess httpx
```

The archived `backend/requirements.txt` is empty; these explicit packages match the current backend imports. If the requirements file is populated in a later revision, install from that instead. If OneDrive interferes with a virtual environment or pip upgrade, create the venv in a directory outside OneDrive and activate it from there.

### 3. Start the application

```powershell
python -m uvicorn backend.main:app --reload
```

Open **http://127.0.0.1:8000** and search for a public Chess.com username.

The browser loads `static/vendor/chess.browser.js`, a classic-script-compatible build. Keep it ahead of `tactics.js` and `ui.js` in `static/index.html`.

## Testing and verification

From the repository root, with a functioning Python environment activated:

```powershell
python -m pip install -r requirements-test-v2.txt
node scripts/v2/run-fast.cjs
```

The fast runner includes:

1. The original **31 frontend regression tests** (legal move handling, invariants, tactics, and Explain state).
2. **9 v2 contract/mutation tests** (including intentional incorrect claims and arrows).
3. An independent **`python-chess` rule oracle** with verified positions and explicit unresolved cases.

**Last locally reported baseline (November 10, 2026):** 31/31 original tests, 9/9 v2 tests, 7 rule-oracle passes, and 4 **UNVERIFIED** historical candidates. These are test outcomes, **not** a guarantee that every engine judgment or tactical explanation is correct. Re-run the harness after changes rather than relying on this snapshot.

Optional smoke tools in `scripts/` cover API responses and browser interaction; these require a running app and, for browser checks, a suitable Playwright setup. The lightweight chess.js browser smoke page is at `scripts/v2/browser-chess-smoke.html`.

### What is not certified yet

- Exact Chess.com-equivalent move labels, accuracy, or estimated ratings.
- Soundness of every sacrifice against all serious defensive replies.
- Every generated claim of a fork, pin, forced material gain, or winning continuation.
- Full browser/UI regression coverage on all devices.

Known candidate cases—including the IQSNIPPY `14...Nxc3` sacrifice and repeated-move classification disagreements—remain explicitly **unverified** until supported by sufficient independent evidence.

## Project structure

```text
backend/
  main.py              FastAPI endpoints, PGN parsing, Stockfish integration
  openings/            Local opening-book data
static/
  index.html           Application layout
  app.js               Navigation and view state
  api.js               Chess.com / backend API interactions
  ui.js                Review panels, classification, explanations, arrows
  tactics.js           Tactical feature detection
  styles.css           Responsive styling
  vendor/              Third-party browser libraries
scripts/
  v2/                  Verification runner and Python chess-rule oracle
tests/                  Frontend regression and contract tests
fixtures/               Known positions and comparison data
stockfish/              Third-party engine distribution (not app-authored C++)
```

## Roadmap

- Expand independently adjudicated tactical fixtures and negative controls.
- Add reproducible real-Stockfish analysis profiles and full-game verification.
- Tighten evidence-backed **Brilliant** / **Great** move detection.
- Validate text, arrows, and explanation continuations against the same tactical facts.
- Expand browser-level responsive, accessibility, and state-restoration tests.

## Attribution

This app uses third-party chess software, including **Stockfish**, **chess.js**, and **chessboard.js**, under their respective licenses. See the repository's third-party license notices and the upstream projects. Stockfish engine source code in this repository is **not authored by this project's maintainer**.

## Harness v2.1 — live Stockfish evidence

The original fast suite now also runs **seven fail-closed engine-adapter contract tests** (with synthetic engine responses). These are **not** the same as running the real engine.

Run the opt-in real-engine lane on a machine with Stockfish installed:

```powershell
python scripts/v2/engine_probe.py --nodes 25000
```

It checks engine-selected and restricted-root continuations for curated, legally verified positions; logs the Stockfish binary hash, evaluations from White's perspective, and fully validated PVs in ignored `artifacts/v2-engine/` files. The historical IQSNIPPY `14...Nxc3` case is **still unverified**; supplying the original full PGN through `--iqsnippy-pgn` permits evidence gathering but does not automatically label it Brilliant.

See [Harness v2.1 engine verification](docs/HARNESS_V2_1_ENGINE.md) for prerequisites, commands, guarantees, and limitations.
