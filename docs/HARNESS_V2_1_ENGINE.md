# Harness v2.1 — real Stockfish evidence lane

**Status:** First opt-in engine evidence lane implemented. An engine run from the developer's own computer is **still required**; adapter tests do not constitute Stockfish evidence.

## Purpose and evidence boundaries

The existing v2 suite checks tactical geometry and the legality of chess positions with `python-chess`; it cannot prove objective engine strength or a Brilliant label.

The new `engine_probe.py` runs **real Stockfish UCI analysis** on independently rule-verified fixture positions. For each case it records:

1. Stockfish's preferred root move at the chosen node budget;
2. a **restricted-root** search of the exact played move, even if it is not Stockfish's top choice;
3. the engine's preferred reply after the played move;
4. where a known legal recapture exists, a restricted-root search of that defensive move.

**Every PV move is replayed and checked for legality with `python-chess`.** An invalid line, absent score/PV, missing Stockfish binary, non-Stockfish executable, or invalid fixture **fails**, rather than being counted as passing or silently skipped.

The two initial cases are:

- `ENGINE-PAWN-RECAPTURE-001`: the `exd5` position, with legal `...Qxd5` recapture;
- `ENGINE-FALSE-PIN-001`: the `Be3` position, where `...fxe3` can capture the bishop.

These **do not** assert that Stockfish must select the played move, that a pin wins material, that an exact centipawn score is universal, or that a candidate move deserves a specific move-quality label.

## Requirements

- Node.js is used by the fast regression runner but **not** by the Python engine probe.
- Use your existing `chess-bot-tests` environment or another environment with `python-chess==1.999` installed.
- Provide a working **Stockfish executable**. On the existing Windows project, the default is:
  `stockfish/stockfish-windows-x86-64-avx2/stockfish/stockfish-windows-x86-64-avx2.exe`
- The executable is not Git-tracked; on a different setup pass `--engine` explicitly or set `CHESS_STOCKFISH`.

From the project root, in Windows PowerShell:

```powershell
python -m pip install -r requirements-test-v2.txt
node scripts/v2/run-fast.cjs
python scripts/v2/engine_probe.py --nodes 25000
```

A custom engine path:

```powershell
python scripts/v2/engine_probe.py --engine "C:\Tools\Stockfish\stockfish.exe" --nodes 25000
```

Results are written to **`artifacts/v2-engine/latest.json`**, which is ignored by Git. The JSON records the engine name, binary SHA-256, single-thread/16 MiB hash profile, NNUE option names, search nodes/depth, evaluation **from White's perspective**, full legal UCI/SAN PV, and input-fixture SHA-256 hashes.

For a stronger comparison, increase the search budget in a separate run and use a different output path:

```powershell
python scripts/v2/engine_probe.py --nodes 100000 --out artifacts/v2-engine/deep.json
```

To pin an executable to an **already verified** SHA-256, supply `--require-sha256 <hash>`. Fixed node counts, a single thread, and a binary hash aid repeatability but do not guarantee identical PV or evaluations on different hardware, builds or NNUE configurations. An external NNUE file's *contents* are not independently hashed by this first iteration.

## IQSNIPPY 14...Nxc3

The exact game PGN/FEN has **not** been recovered. This case remains `UNVERIFIED` in the canonical fixture registry; the screenshot/reported Chess.com Brilliant classification is not used as authoritative ground truth.

When the **actual full game PGN** is available locally, run:

```powershell
python scripts/v2/engine_probe.py --nodes 100000 --iqsnippy-pgn "C:\path\to\iqsnippy-game.pgn" --out artifacts/v2-engine/iqsnippy.json
```

The script requires a **complete standard-start PGN** with IQSNIPPY named as White or Black, reconstructs all **27 preceding half-moves**, looks for **exactly one black move 14...Nxc3**, and searches both Stockfish's best move and the played move specifically, plus its best defense. The evidence JSON records all prior UCI moves and the supplied PGN's SHA-256. It **rejects** a missing or unmatched PGN; it never fabricates a FEN. This establishes an engine observation, **not** a Brilliant verdict. A deeper defensive search and separately reviewed classification policy are still required.

Do not commit personal PGNs or engine output to Git until you have reviewed their contents, game provenance and public-sharing implications.

## What runs in the fast gate

`node scripts/v2/run-fast.cjs` now also executes **seven adapter contract tests** in `scripts/v2/test_engine_probe.py`. They use a fake engine only to verify that the integration catches:

- an illegal PV;
- Stockfish ignoring a restricted-root request;
- a missing engine;
- an absent historical PGN;
- invalid or missing fixture structure.

These tests are explicitly separate from real-engine observations; the fast gate **does not call Stockfish**.

## Remaining work

- Collect the exact IQSNIPPY PGN, its relevant defensive lines and independent reviewer criteria.
- Add higher-budget Stockfish profile comparisons and score-stability diagnostics.
- Tie accepted engine evidence to production `computeMoveQualities` and concrete category disagreements.
- Test the actual FastAPI `/api/analyze` route and browser interactions against the same reviewed cases.
- Only promote historical fixtures out of `UNVERIFIED` when their evidence and acceptance criteria are complete.
