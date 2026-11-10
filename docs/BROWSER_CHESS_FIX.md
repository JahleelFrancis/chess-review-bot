# chess.js 1.4.0 browser compatibility fix — separate, reversible overlay

## Root cause

Your archived `static/vendor/chess.js` is the **CommonJS** distribution (`exports.Chess = Chess`) but `static/index.html` loads it as a **classic script** (`<script src="/vendor/chess.js"></script>`). Normal browsers do not provide `exports` and may raise a runtime error. A Node test VM with an `exports` shim hides that problem.

## What this ZIP includes

- `static/vendor/chess.browser.js`: Same chess.js 1.4.0 code from the supplied archive, wrapped in an independent IIFE which keeps `exports` private and makes `window.Chess` available. **No production files overwritten by ZIP extraction** (new filename).
- `scripts/v2/browser-chess-smoke.html`: Actual classic-script browser test: captures script errors, tests `window.Chess`, legal moves, SAN, FEN, undo, promotion, and PGN/checkmate.
- `docs/CHESS_JS_LICENSE.txt`: BSD-2-Clause license for original code.

Original archived vendor file SHA-256: `ccf63ba6a6023ccebc8c110361361b8e14f85d40b556eff387baa8ede4fdd21f`. Check your currently deployed vendor version before swapping; if it differs, build from the *current* version instead of assuming this 1.4.0 file is appropriate.

## Safest installation sequence

1. **Commit/back up source first.** Extract ZIP into project root alongside `static/` and `backend/`. This adds a new JS file, not a replacement for `chess.js`.
2. In a temporary test branch, change ONLY this line in `static/index.html`:

   Before: `<script src="/vendor/chess.js"></script>`

   After:  `<script src="/vendor/chess.browser.js"></script>`

3. Restart FastAPI if needed, hard-refresh your real analysis page and inspect the Console for runtime errors.
4. Open `http://127.0.0.1:8000/scripts/v2/browser-chess-smoke.html` ONLY if that folder is served as static files (usually it is not). Otherwise open `scripts/v2/browser-chess-smoke.html` directly via file explorer in Chrome/Edge, or serve the project folder with `python -m http.server 8765` and visit `http://127.0.0.1:8765/scripts/v2/browser-chess-smoke.html`. It should show `PASS`.
5. Also verify actual game analysis, arrows, repetition, promotion and Explain/undo controls on both desktop/mobile; the smoke page tests chess.js only, not your full app.
6. If any regression occurs, restore the original single HTML line. The old file remains in place.

## Security and version policy

This is a self-contained browser bundle of **exactly the archived 1.4.0 chess.js library**, no network dependencies, no additions to the chess rule methods, no app source edits. Future vendor upgrades should be properly bundled for the browser and tested in Playwright / Chromium as their own CI lane. A no-import CommonJS wrapper is valid for this specific archived distribution but must not be blindly applied to arbitrary CommonJS packages using `require(...)`.
