# Chess Review Bot — Harness v2: Verified Chess Reasoning

**Implementation status (Nov. 9, 2026):** **starter implemented and exercised**, full engine/browser/Chess.com calibration lanes still outstanding.

## 1. Non-negotiable contract: evidence, not plausible prose

A release is safe when every strong chess claim is either supported by independently checkable evidence or **not rendered as a certainty**. We can't mathematically prove every move-quality label: scoring systems and engines have approximations, and chess itself is enormous. We *can* reject illegal states, catch contradictory labels/arrows, verify simple tactical geometry, and preserve uncertainty about unproved forcing lines.

**Do not** use `computeMoveQualities()` to create the expected answer for a test of `computeMoveQualities()`; do not use `deriveMoveIdea()` to decide whether `deriveMoveIdea()` is correct. The test must depend on a separately reviewed oracle, and be able to fail when both the label and the title are wrong in the *same* way.

### Claim evidence hierarchy

1. **Exact**: chess rules, legal responses, full move history, terminal checks, state restoration, and tablebase results where applicable.
2. **Adjudicated**: a specific tactical claim checked by separate methods and/or reviewers, with engine evidence and *counterexamples*.
3. **Engine benchmark**: relative evaluation under one disclosed Stockfish profile, compared across deeper searches for sensitive cases. Strong evidence of objective soundness, not a proof that every other move loses.
4. **Product calibration**: observed per-ply Chess.com labels with capture/version provenance. Helpful for likeness, not a tactics oracle.
5. **Aggregate screenshots**: broad diagnostic only; swapped individual errors can cancel out in totals.

### Precise status semantics

- **PASS**: a checked assertion matched its independent reference.
- **FAIL**: a required assertion was contradicted, or a required oracle could not execute.
- **KNOWN_FAIL**: a known failing regression with a tracked issue, exact conditions, and an explicit exception policy (not counted as passing).
- **UNVERIFIED**: evidence is insufficient for a claim, so its test is not counted as passing; high-risk feature activation is blocked until reviewed.
- **SKIPPED**: intentionally omitted with explicit reason and tracked scope, never silently counted green.

The current starter implements `rules_verified` and `unverified` in `fixtures/v2/positions.json`; it does not claim that `KNOWN_FAIL`, engine lane, visual lane, or release gates have all been fully built.

## 2. What was actually audited

- `backend/main.py`: FastAPI `/api/analyze` uses `python-chess`, spawns Stockfish, and generates one evaluation per FEN, calling MultiPV from a configured depth.
- `static/ui.js`: `computeMoveQualities(...)` contains the expected-points transform, book decisions, special-category behavior, move explanations, and repeated-position reconciliation. `deriveMoveIdea(...)` also generates text and arrow specifications. The repeated-state reconciliation uses the *first four FEN fields* in its grouping, with a partial safeguard for threefold/halfmove state, rather than always retaining the complete legal history.
- `static/tactics.js`: `ChessTactics.analyzeMove()` provides fork/pin/discovered-attack/capture evidence based on `chess.js`. It is valuable but **not independent** of the rendered frontend chess rules.
- `tests/`: the recovered v1 suite has 31 smoke, data, layout-structure, explanation-state, and curated tactical assertions. Source `ui.js` and backend remain unchanged in this overlay.

This confirms why extracting pure analysis functions is the right *incremental* design seam rather than rewriting the entire frontend or relying on CSS assertions to prove geometry.

## 3. Canonical, immutable fixture registry

For each accepted position, store:

- unique stable case ID, source, game/ply and date, and full position context;
- either `start_fen` + **all** `history_uci` leading to the position, or a standalone `fen` that explicitly makes *no* history-sensitive claims;
- played UCI and human-reviewed SAN, resulting full FEN, move legality;
- independent rule assertions: attacked pieces, legal immediate recaptures, rook/queen rays, check, repetition rights, etc.;
- evidence status plus missing inputs when not verified;
- expected/forbidden *text semantics* and allowed/forbidden *arrow endpoints*;
- for engine-backed cases, binary/NNUE SHA-256, engine version, UCI options, protocol output, search budget, score POV, PV, and reviewer notes;
- Chess.com label only as `external_reference` / diagnostic, never silently as absolute ground truth.

The starter's 11 fixtures include 7 independently rule-checkable examples and 4 explicit unresolved historical tasks. **The IQSNIPPY fixture deliberately has `position: null`; never invent a FEN for a game not provided.**

## 4. Testing architecture — implemented starter and future lanes

| Lane | Purpose | Now | Gate for future merges |
| --- | --- | --- | --- |
| v1 regression | Known structural/rule/perspective behaviors | 31 passed | blocking |
| v2 fixture contract | Independent curated text/arrow truth against production renderer | 7 contract/registry checks passed | blocking |
| Source mutation | Inject obvious broken classification and reversed arrows into isolated source behavior | 2 mutant sentinels passed (mutants detected) | expand before release |
| Python oracle | Replays board positions and *full* repetition history separately from `chess.js` | 7 rule cases passed; 4 unverified | blocking on relevant facts |
| Engine | Verify objective sacrifice soundness, moves around classification thresholds, alternative defensive lines | **not built/run** | blocking on classification/tactic changes |
| Browser | Real Playwright UI interactions, geometry, visual baselines | **not built/run for v2** | blocking on UI changes |
| Full PGNs | Per-ply classification, consistency, legal PV and insight snapshots | v1 script available only | blocking once curated |
| Calibration | Per-ply confusion matrix vs recorded Chess.com | aggregate v1 refs only | diagnostic until per-ply truth is collected |

### Engine lane: maximize repeatability without pretending engine determinism is universal

- Pin Stockfish **binary SHA-256**, network/NNUE hash, binary version, `Threads=1`, `Hash`, `MultiPV`, Syzygy options, analysis mode, full move stack, engine search budget, and analysis code revision.
- Prefer fixed `nodes` for machine-independent *work budget* and document depth, PV, score POV, mate vs cp, WDL. This improves repeatability, but does **not** guarantee identical output across CPU architectures, builds, or Stockfish versions.
- Clear hash and reset game state at case boundaries. Store engine output snapshots and source hashes; the fast lane tests those fixed snapshots, while the slower lane recomputes them.
- For special move candidates analyze baseline best move, **the played move specifically** (with `root_moves=[played]` when needed), and plausible defensive replies at deeper budgets. A shallow MultiPV omission is not evidence the played move was bad, and one best line is not evidence a rook is *forced* to be lost.
- Declare a near-threshold result uncertain if evaluation or PV changes across profiles; do not force it into an exact category simply to satisfy a benchmark.
- `python-chess` supports `engine.analyse(board, Limit(nodes=...), multipv=..., root_moves=...)`, with original move stack preserved; this is preferable to reimplementing UCI state tracking by hand.

### Classification lane

Test each numerical expected-points boundary immediately below, exactly at, and immediately above your **versioned policy**. Chess.com's Feb. 9, 2026 public Classification V2 documentation reports: Excellent `0–0.02`, Good `0.02–0.05`, Inaccuracy `0.05–0.10`, Mistake `0.10–0.20`, Blunder `0.20–1.00`; Best and special categories require extra rules. Boundary ownership and floating-point tolerances must be defined by **our** implementation. The exact rating-to-expected-points model and various override rules remain proprietary or incomplete; report differences as calibration, not independent rules failures.

Store a classification trace rather than just the word `Excellent`:

```json
{
  "policy_version": "classification-v2.x",
  "score_pov": "white",
  "ep_before": 0.61,
  "ep_after": 0.57,
  "ep_loss": 0.04,
  "base_category": "good",
  "special_override": null,
  "final_category": "good",
  "evidence_refs": ["engine-case-123"],
  "uncertainty": null
}
```

**Brilliant** requires a separate, rigorously tested gate: is it a meaningful piece sacrifice, near-best under credible defense, not leaving the player badly worse, and not merely decorating an already overwhelmingly won position? Chess.com describes such factors publicly, but our product should use an explicit versioned policy. Tests need adversarial sacrifices (hopeless offers, forced recaptures, multiple ordinary non-sacrifices) and close threshold controls. A `Brilliant` label must not override a tactical refutation.

### Claims and arrows share one certificate

Instead of three independent guesses:

```text
Position + played move + engine records
  -> chess rules oracle / vetted tactics facts
  -> typed Fact[] + certainty + supporting candidate lines
  -> category reason / explanation text / arrows / Explain continuation
  -> claim and arrow validator (block unsupported certainty)
```

A suggested typed fact object:

```json
{
  "id": "TACTIC-001",
  "type": "discovered_attack",
  "actor": "e1",
  "target": "e7",
  "verification": "rules_verified",
  "claim_strength": "attack_only",
  "arrows": [{"from": "e1", "to": "e7", "role": "new_attack"}]
}
```

A fact that proves only **attacks a rook** can authorize “threatens the rook,” not automatically “wins the rook.” `forced` is reserved for checked all-reply finite tactical proof, verified tablebase, or carefully bounded statements that disclose engine assumptions. No statement should downgrade from unverified to certified merely because a language generator sounds convincing.

### Explanation state machine

`GAME -> EXPLAIN_START -> EXPLAIN_STEP_1...N -> EXPLAIN_END -> GAME`

Save real ply/FEN/orientation/selection/overlays when entering. Replay each PV move legally on a separate variation board. Stop at a justified tactical point, terminal outcome, evidence horizon, or explicit safety cap. For Got it, restore exact game state even after exit mid-variation, changing tabs, resize, or repeated Explain. Text must distinguish “the shown engine continuation” from “every opponent reply.” The actual game PGN must never be changed by tutorial navigation.

### Real-browser contract

Use Playwright on a seeded analyzed game at desktop 1440x900, compact desktop 1024x768, tablet 900x900, mobile 390x844 and 320x568, plus 200% zoom and keyboard navigation. Check **DOM geometry, zero horizontal overflow, visible active buttons, exact state restoration and console errors**. Playwright snapshots are supplementary. Pin browser, platform and font environment: otherwise pixel comparisons can vary despite correct CSS.

## 5. High-value adversarial and metamorphic cases

- Double-check, forced moves, en passant, underpromotion, castling rights, checkmate vs mate-0 evaluation, stalemate, insufficient material.
- A bishop *geometrically* attacks a knight with a queen behind, but can be captured immediately. Distinguish weak ray geometry from an effective pin.
- Forked pieces defended or hanging for different reasons; a defended attacker may create an *attack*, not an automatic win.
- Legal king responses to checks, recaptures, intermediary captures and material exchange sequences; claims about forced material gain must account for credible alternatives.
- Same first four FEN fields but different 3-fold/5-fold history, halfmove clock, claim rights, or engine context. The v2 Python oracle already shows one position with two different threefold statuses.
- Same PGN from both usernames, both board orientations, and navigation after Explain; labels/evidence must be identical, only presentation differs.
- MultiPV reordering, deeper search reversal, missing engine entries, invalid PV, stale request/restart, network/API errors and intentionally damaged arrow coordinates.
- Run mutants that return Excellent for everything, put “Brilliant” on every sacrifice, reverse arrows, swap side-to-move, forge material gains, truncate every Explain line, and break Got it restoration.

## 6. Release gates and staged rollout

**Stage 0 (achieved on uploaded snapshot):** Recover 31-test baseline, inspect source, create 11 fixture registry records, implement Python rule oracle, evidence-to-text/arrow contracts and two live source-mutation sentinels. Keep production source unchanged.

**Stage 1:** Export complete PGNs, per-ply screenshots and move-by-move Chess.com labels from the historical cases. Freeze a verified corpus and source hashes. Record every unresolved disagreement as a case ID; preserve unknowns.

**Stage 2:** Extract `classifyMove(ctx)`, `detectTacticalFacts(ctx)`, `selectClaims(facts)`, `renderArrows(claims)` and `buildExplainLine(ctx)` incrementally from `ui.js`, preserving v1 behaviors. Add high-impact claim validators at the boundary before rendering.

**Stage 3:** Build reproducible real Stockfish analysis, alternative reply stress, depth/node escalation and near-threshold uncertainty report. Specifically adjudicate IQSNIPPY 14...Nxc3; do not hardcode Brilliant from a screenshot.

**Stage 4:** Build real Playwright Explain controls and geometry, add full-game corpus and per-ply calibration reports, expand source mutation and property-based state tests.

**Release guard:** all verified invariants pass; every high-impact known issue either has a passing regression or a visible unresolved block on the affected feature; no unverified forcing/Brilliant claims leak; username/board perspective doesn't change semantics; forced lines are legal and only as strong as their evidence; browser regressions are checked in a real browser. Keep Chess.com similarity as separately disclosed calibration rather than a promise of exact parity.

## 7. Run commands and test artifact hygiene

From the project root, after installing `python-chess==1.999`:

```bash
node scripts/run-harness.cjs       # exact v1 regression tests, unchanged scope
node scripts/v2/run-fast.cjs       # v1 + new Node contracts/mutants + independent Python oracle
python scripts/v2/oracle.py       # independent chess truth and UNVERIFIED candidates only
```

`run-fast.cjs` returns nonzero if a test fails *or* a required Python oracle cannot launch. Candidate cases are visible in the report but are not counted as passing. The script is self-contained; no live engine, network, or browser is required for this **first** gate.

### Audit caveat: archived chess.js build

The ZIP's `static/vendor/chess.js` has top-level CommonJS `exports.*` assignments even though `index.html` loads it in a classic script. The VM runner previously errored with `exports is not defined`; the recovered harness helper now defines a minimal `exports` object **inside its isolated test VM only**. This lets v1/v2 unit tests run; it does **not** make the bundle valid for browser execution. Check browser console and package an explicit browser-compatible `chess.js` build after confirming the installed production behavior. No application files were changed by this starter overlay.

## Technical reference links

- Chess.com Classification V2 (Feb. 9, 2026): https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc
- python-chess UCI analysis docs: https://python-chess.readthedocs.io/en/stable/engine.html
- Playwright snapshots and environment caveats: https://playwright.dev/docs/test-snapshots
- Hypothesis reproducibility and stateful testing: https://hypothesis.readthedocs.io/en/latest/settings.html
