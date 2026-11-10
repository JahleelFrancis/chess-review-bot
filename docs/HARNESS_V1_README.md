# Chess Review Bot — reproducible regression harness (v1)

Built around the chess analysis and UI code from the **Nov. 4, 2026 pre-phase-2 consistency bundle**. It does **not** replace or edit `ui.js`, `tactics.js`, `styles.css`, the opening book, or the backend. The saved bundle passes the deterministic suite; re-run against your CURRENT files after installing. Different source revisions can correctly fail if they lack one of the tested features.

## Install

1. Back up or commit your repository.
2. Extract this ZIP **into the project root** (the folder containing `static/` and `backend/`). It creates `tests/`, `scripts/`, `fixtures/`, and `docs/`. Merge with existing test folders; it does not overwrite app source files.
3. Requires **Node.js 18+**, plus your existing `static/vendor/chess.js`, `static/tactics.js`, `static/ui.js`, `static/index.html`, and `static/styles.css`.
4. Run from the project root:

```bash
node scripts/run-harness.cjs
```

The included runner avoids shell-wildcard issues on PowerShell. To point at a different static directory, set environment variable `CHESS_STATIC_DIR` to its absolute path before running (e.g., PowerShell `$env:CHESS_STATIC_DIR = 'C:\\path\\to\\project\\static'`).

**Expected on the available Nov. 4 snapshot:** **31 passing tests**. They run in about a second, without Stockfish, Python, a browser, or a network connection. Current project files are the source of truth for the actual test run; passing the snapshot does not prove every later edit passes.

## What's tested automatically

**Rules and data contracts**: chess.js integration, engine FEN/SAN/UCI alignment, castling, en passant, promotion, mate-0 sign, legal tactical moves, invalid-move rejection, finite scoring, and no late phantom book moves with an empty opening database.

**Quality stability**: Black/White username perspective independence, repeated equivalent position + same move yielding the same category, unchanged original expected-points loss after reconciliation, and 50-move/different-position exceptions. Determinism on a 48-ply synthetic game.

**Tactics/insights**: checking bishop fork of a king and rook, two correct arrows, real relative pin versus immediately capturable pseudo-pin, discovered attack, forced versus mere attack evidence, capture/exchange evidence, and no fabricated forced gain when the tactical module is missing.

**Explanation mode**: optional entry, valid engine PVs, stopping illegal PVs, 2- to >5-ply dynamic line lengths, preserving current game ply, and exact return to the actual position via Got it. Text about sample continuations must not promise an inevitable win. CSS and script-loading structural contracts are also checked.

The tests above are **deterministic unit/integration tests**, not engine-strength proofs. More complex tactical soundness still needs verified per-position fixtures and engine analysis, especially the proposed **Brilliant** classifier.

## Full game snapshot audit

1. Analyze a Chess.com game in your local bot.
2. Paste the contents of `scripts/capture-game-devtools.js` into the browser DevTools Console. It downloads a local JSON containing game moves, FENs, engine results, move classifications, explanation texts, and arrow coordinates. It sends nothing to an external service.
3. Save the file somewhere convenient, ideally `snapshots/` (not included in this package).
4. Run:

```bash
node scripts/inspect-snapshot.cjs snapshots/game.json
```

This rejects corrupt move orders, impossible moves, FEN mismatches, invalid losses, and malformed arrows. It reports unusual repeated labels and illegal engine PVs as warnings.

To compare **the same game from both searched usernames**, save two separate JSON files:

```bash
node scripts/inspect-snapshot.cjs snapshots/white-view.json --compare snapshots/black-view.json
```

The result should be **PASS: Same moves, positions, and categories across both perspectives**. A difference in per-ply classification is a failing invariant—not a calibration disagreement.

For the five games previously compared with Chess.com (including accuracy and game-rating deltas when the capture includes them):

```bash
node scripts/inspect-snapshot.cjs snapshots/freyz10.json --reference freyz10-vs-hipporex123
node scripts/inspect-snapshot.cjs snapshots/ocampeon.json --reference ocampeon-vs-fritzisbadatchess1
```

See `fixtures/chesscom-reference-counts.json` for all five reference IDs. A difference in category totals is reported as **diagnostic drift** and never automatically fails the test. The screenshot values are transcriptions, not Chess.com's private classification criteria. The real ground truth needed for exact per-move comparisons is the complete PGN and review-by-move labels.

## Optional live tests

If FastAPI and Stockfish are running, check the real analyze endpoint:

```bash
node scripts/api-smoke.cjs http://127.0.0.1:8000
```

Requires the local server to be running with a configured engine. It submits a six-ply test PGN and validates that the output matches legal chess, with one evaluation per FEN.

For responsive UI and Explain/Got it controls, install Playwright **only if you want browser tests**:

```bash
npm install --save-dev playwright
npx playwright install chromium
node scripts/browser-smoke.cjs http://127.0.0.1:8000/USERNAME/analysis/GAME_ID
```

Point it at a **valid analyzed-game URL** (not the landing page). It visits desktop, tablet, and mobile widths, attempts the explanation flow, checks for clipping/overlap on desktop, and writes screenshots into `harness-screenshots/` for visual review. This optional browser script is prepared but **was not run in the creation environment** because Playwright and your local server are unavailable. A screenshot from it is not a replacement for manual checking of arrows and chess correctness.

## What the suite DOES NOT yet certify

- Chess.com-exact thresholds for Best/Excellent/Good/Inaccuracy/Mistake/Miss/Blunder and game-rating formulas; Chess.com's internal implementation is not public and changes over time.
- That a candidate sacrifice is **Brilliant** rather than a good or winning move. This needs legal FEN + played move + *all reasonable opponent replies* + an engine search deep enough to test whether the sacrifice holds. An engine not initially ranking the move first is NOT sufficient evidence by itself.
- That every natural-language claim (pin, fork, discovered attack, defender removal, trapped piece, material win) is true for every position. The snapshot audit can catch malformed arrows, but proving semantics requires expanding the position corpus.
- Pixel-perfect mobile behavior on arbitrary screen sizes. The browser smoke covers representative sizes; manually review long explanations and very small screens.

These are documented coverage gaps—not green tests. See `docs/COVERAGE.md` for the exact known scenarios, recommended next fixtures, and a staged gate for future work. **Do not loosen an invariant to improve similarity scores.**

## Suggested workflow

Before any classifier, insight, arrow, or layout change: run `node scripts/run-harness.cjs`; fix all deterministic regressions. Then reanalyze one original PGN at the *same engine version, depth, MultiPV, threads, hash and opening book*, export the snapshot, and review the changed plies. Only then compare all five reference games and add the new case as a regression fixture. Separate algorithm changes from CSS changes in commits so a failed test is easy to trace.

## CI

The optional `.github/workflows/chess-review-harness.yml` runs the deterministic suite on every relevant push or pull request, using Node 22. Merge it into your existing GitHub Actions setup if you want automatic regression protection. It does not start Stockfish or the browser.
