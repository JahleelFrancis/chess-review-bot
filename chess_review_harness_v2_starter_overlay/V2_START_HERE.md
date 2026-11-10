# Chess Review Bot — Verified Chess Reasoning v2 (starter overlay)

This package upgrades the existing **v1 regression harness** with an evidence registry, independent chess-rule checks, frontend-to-evidence contracts, and two source-level mutation sentinels. It is **not** a completed end-to-end certification of chess reasoning or a replacement for the application.

## Install into your real current project

1. Back up/commit your current application. **Do not replace your current app with the older chess.zip used during this audit.**
2. Extract this small ZIP into your existing project root, where `static/`, `backend/`, and `tests/` live. Review any merge conflicts. The overlay does **not** contain or overwrite `static/ui.js`, `static/tactics.js`, `static/index.html`, `static/styles.css` or `backend/main.py`.
3. Ensure Node 18+ and Python with the existing `python-chess` dependency:

   ```powershell
   pip install -r requirements-test-v2.txt
   node scripts/v2/run-fast.cjs
   ```

4. Inspect the explicit `PASS`, `FAIL`, `UNVERIFIED` statuses. An unavailable independent oracle is a **nonzero exit** (fail-closed), not a green pass.

## Observed local audit result — Nov 9, 2026

The supplied source snapshot had front-end files modified Nov 4, 2026. After restoring v1 test files and loading the archived CommonJS-style chess.js with a test-only `exports` shim:

- **31/31** existing v1 Node tests passed.
- **9/9** new v2 Node tests passed (five fixture-to-explanation contracts, registry validation, contract mutation check, and two actual source-behavior mutation sentinels).
- **7/7** independent python-chess rule fixtures passed (five stand-alone chess positions, two same-board/different-history repetition scenarios).
- **4 UNVERIFIED** historical candidates: IQSNIPPY Brilliant, repeated Nf5+, real-browser Explain/geometry, and stronger material-forcing proof.

The python-chess checks were actually executed in the audit environment using the `chess 1.11.2` library extracted from the user-provided environment. This is not equivalent to testing a live Stockfish engine or Playwright browser. You must rerun the gate on **your latest** source files before treating the status as current.

## Important compatibility finding

The archived `static/vendor/chess.js` references CommonJS `exports.*` at top level while `index.html` loads it as a normal browser script. Our test-only VM shim allows legacy unit tests to execute, but **does not fix or certify browser execution**. An unshimmed script evaluation raises `ReferenceError: exports is not defined`; check this in real browser devtools and replace/build the vendor bundle in the application if reproduced. We did **not** patch your production source.

## Files to look at first

- `docs/HARNESS_V2_IMPLEMENTATION.md`: verified reasoning architecture, rollout, and release gates.
- `fixtures/v2/positions.json`: per-position truth and explicit missing evidence.
- `scripts/v2/oracle.py`: independent `python-chess` rule/history oracle.
- `tests/v2/*.test.cjs`: evidence-based frontend contracts and source-level mutation sentinels.
- `scripts/v2/run-fast.cjs`: cross-platform fail-closed fast gate.
- `docs/HARNESS_V1_README.md` and `docs/COVERAGE.md`: original v1 documentation.
- `docs/PREVIOUS_V2_BLUEPRINT.md`: exact recovered design document from our prior conversation.

## Do not misread the success count

A green test verifies only its declared contract. **We have not shown that Brilliant is correct, the best opponent counterplay was searched, every sentence is sound, engine settings are reproducible on all devices, or the UI has no actual browser glitches.** These are future verification lanes, not green results.
