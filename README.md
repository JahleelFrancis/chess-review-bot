# Chess Review Bot ♟️

An independent, locally run chess game-review web app. Enter a public **Chess.com** username, browse archived games, and analyze complete games with **Stockfish** on an interactive chessboard.

> **Status: active development.** Chess Review Bot is not affiliated with Chess.com. Its move classifications, accuracy estimates, performance ratings, and tactical explanations are independently implemented approximations—not exact reproductions of Chess.com's Game Review.

## Features

- **Chess.com game browser:** search public players, browse monthly archives, and select games for review.
- **Engine analysis:** parse PGNs, calculate positions and engine evaluations, and inspect candidate continuations using Stockfish.
- **Interactive board:** navigate moves, inspect an evaluation bar and move list, and view highlights and tactical arrows.
- **Move feedback:** classify move quality, highlight tactical ideas, and show explanations tied to selected moves.
- **Review overview:** evaluation timeline, move-quality breakdown, estimated accuracy, and estimated game performance ratings.
- **Explain mode:** explicitly enter a suggested continuation, step through its moves, and use **Got it** to return to the actual game.
- **Opening recognition:** consult the local opening dataset for opening moves and names.
- **Verification harness:** regression tests, independently reconstructed chess positions, and adversarial tests that reject some deliberately false tactical claims.

## Screens and workflow

1. Enter a Chess.com username on the landing page.
2. Choose an archive month and a game.
3. Run game analysis, then review its **Overview**, **Moves**, and **Info** views.
4. Navigate to a move to see the board position, its estimated quality, and available tactical insights.
5. When offered, select **Explain** to explore a variation; **Got it** returns to the game.

## Tech stack

| Layer | Technology |
| --- | --- |
| API/backend | Python, FastAPI, httpx |
| PGN and rules | python-chess (backend), chess.js (browser) |
| Chess engine | Stockfish through the UCI protocol |
| Frontend | Vanilla JavaScript, HTML, CSS, chessboard.js, jQuery |
| Tests | Node.js built-in test runner, python-chess oracle; optional browser smoke checks |

Stockfish is third-party chess software; the bundled C/C++ engine source is **not** application-authored code.

## Getting started (Windows / PowerShell)

### Prerequisites

- Python 3.10+ and a functioning `pip`
- A locally installed Windows Stockfish executable compatible with your CPU
- Node.js 18+ for the JavaScript verification tests

Clone the repository:

```powershell
git clone https://github.com/JahleelFrancis/chess-review-bot.git
cd chess-review-bot
```

### Python dependencies

```powershell
py -3 -m venv venv
.\venv\Scripts\Activate.ps1
python -m pip install fastapi uvicorn python-chess httpx
```

**Note:** `backend/requirements.txt` is currently empty, so installing only from that file would **not** install the backend dependencies. The explicit packages above correspond to imports in `backend/main.py`.

If your project is stored in a OneDrive-synchronized folder and the virtual environment is locked during installation, create the environment somewhere outside OneDrive.

### Stockfish setup

The current backend's `STOCKFISH_PATH` in `backend/main.py` expects the following executable **relative to the project root**:

```text
stockfish/stockfish-windows-x86-64-avx2/stockfish/stockfish-windows-x86-64-avx2.exe
```

Download a suitable build from [Stockfish](https://stockfishchess.org/download/) and place the executable at that path, or change `STOCKFISH_PATH` in `backend/main.py` to match your machine. The repository ignores `*.exe` files; do not assume the engine binary is included in a fresh clone. This backend configuration is currently Windows-oriented.

### Start the app

```powershell
python -m uvicorn backend.main:app --reload
```

Open **http://127.0.0.1:8000/** and search for a public Chess.com player.

The frontend intentionally loads `static/vendor/chess.browser.js` (a classic-browser-compatible build) before `tactics.js` and `ui.js`. Do not replace it with the archived CommonJS `chess.js` file without revalidating browser loading.

## Verification and tests

Install the test dependency in a Python environment:

```powershell
python -m pip install -r requirements-test-v2.txt
```

Run the fast verification suite from the repository root:

```powershell
node scripts/v2/run-fast.cjs
```

The runner currently includes:

- **31** original deterministic frontend regression tests.
- **9** v2 fixture, explanation/arrow contract, and mutation tests.
- An independent Python rules oracle. In the locally reported November 10, 2026 baseline it had **7 PASS**, **0 FAIL**, and **4 UNVERIFIED** historical candidates.

The locally reported result was **31/31 + 9/9 + 7/7 verified checks passing**. These are historical results, not a claim that the latest checkout has been run here or that every analysis is objectively correct. Always rerun after changes.

**Known verification gaps:** engine-backed adjudication of controversial sacrifices (including the IQSNIPPY `14...Nxc3` candidate), repeated-position classification discrepancies, broad real-game evidence, and full browser interaction/geometry coverage. `UNVERIFIED` cases are not counted as passes.

See [Harness v2 implementation plan](docs/HARNESS_V2_IMPLEMENTATION.md) and [coverage notes](docs/COVERAGE.md) for the verification roadmap.

## Repository map

```text
backend/
  main.py                FastAPI routes, Chess.com requests, PGN and engine analysis
  openings/              Local opening data
static/
  index.html             App layout
  app.js                 Navigation and view state
  api.js                 Frontend API integration
  ui.js                  Move feedback, explanations, review panels and arrows
  tactics.js             Tactical analysis helpers
  styles.css             Layout and responsive styling
  vendor/                Third-party browser dependencies
scripts/
  v2/                    Fast verification runner and independent Python oracle
tests/                    Deterministic regression and adversarial tests
fixtures/                 Position fixtures and comparison data
docs/                     Harness coverage and design documents
stockfish/                Third-party engine distribution and source
```

## Roadmap

- Expand independently reviewed tactical fixtures and negative controls.
- Establish reproducible, pinned Stockfish engine benchmarks for complete games.
- Improve evidence-backed **Brilliant** and **Great** move detection.
- Make explanations, arrows, and continuation claims depend on the same verified chess facts.
- Add automated browser interaction, responsiveness, and accessibility regression coverage.

## Third-party software and attribution

This project uses [Stockfish](https://stockfishchess.org/), [chess.js](https://github.com/jhlywa/chess.js), [chessboard.js](https://chessboardjs.com/), and [jQuery](https://jquery.com/), subject to their respective licenses. Refer to `THIRD_PARTY_LICENSES/`, `docs/CHESS_JS_LICENSE.txt`, and the applicable upstream licenses. The Stockfish engine source included under `stockfish/` belongs to its upstream contributors; its C/C++ files are not the application's author-written source.

## License

See [LICENSE.md](LICENSE.md) for the repository's license notice and the separate notices for third-party components.
