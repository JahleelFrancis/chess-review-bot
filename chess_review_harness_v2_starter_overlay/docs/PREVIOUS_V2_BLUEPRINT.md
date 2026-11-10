# Chess Review Bot — Verified Chess Reasoning Harness v2

**Status:** Design proposal, **not implemented or executed**. Based on the existing v1 harness in `chess_harness_audit/`, the five Chess.com aggregate comparison fixtures, and the recurring issues reported during development.

## Objective

Make incorrect chess claims difficult to ship, make regressions reproducible, and distinguish objective correctness from similarity to a proprietary review product. The goal is not an impossible guarantee of perfect analysis in every position, but a system that refuses unsupported claims, exposes uncertainty, and detects known failure modes before release.

## Core standards

1. **Independent oracle:** Do not verify a classifier by asking the same classifier what the answer should be. Use rule-level checks from python-chess or chess.js, independently curated positions, deep/fixed engine references, endgame tablebases where applicable, and annotated Chess.com comparisons as distinct evidence classes.
2. **Claim-level proof:** Each sentence and tactical arrow must map to a structured, replayable fact. Render no unverified “forced win,” fork, pin, free piece, mate, or certain continuation.
3. **Reproducibility:** Pin code revision, fixture version, Stockfish binary build/NNUE, UCI configuration, search budget, move history, opening-book hash, and platform. Store engine output snapshots for fast deterministic tests; live searches belong to slower lanes.
4. **Three results, not one:** `PASS`, `FAIL`, and `UNVERIFIED`; known defects should be visible as expected failures, never included in the green pass total. In pytest, use strict `xfail` for explicitly documented known bugs, not broad skips.
5. **Negative assertions:** The absence of hallucinated tactics is as important as presence of correct ones. All high-impact positive fixtures should have deceptive near-miss controls.
6. **Traceability:** Every reported historical defect receives a unique ID with a minimal FEN, UCI move, source game/ply, reproducible inputs, and acceptance criteria. A fix must add or strengthen a failing test first.
7. **Separated goals:** Objective chess correctness is blocking; matching Chess.com move-quality counts is diagnostic and a calibration objective, because Chess.com's implementation, engine strength, and settings differ.

## What the current v1 suite does and does not do

- `tests/03-repeat-and-perspective.test.cjs`: confirms consistency on synthetic evaluation data and a specific repeated position, but does not replay the full histories for draw-claim differences.
- `tests/04-explanation-state.test.cjs`: checks legal PV truncation and explanation restoration in a mocked board; it cannot establish that the PV's interpretation is tactically sound or that controls work in a real browser.
- `tests/08-semantic-tactics.test.cjs`: has useful pins and discovered attacks, but only a few curated examples.
- `tests/09-insight-claims.test.cjs`: validates particular phrases and category/title agreement; an internally consistent false label can still pass.
- `tests/06-snapshot-and-calibration.test.cjs`: validates reference-count dataset completeness, not correctness of per-ply labels; actual Chess.com drift is printed rather than treated as authoritative ground truth.
- `scripts/inspect-snapshot.cjs`: verifies move and FEN structure, warns about illegal PVs and some unsupported tactical text, but cannot prove tactical claims. It groups repeated positions by the first 4 FEN fields and omits the history required to fully assess repetition rights.
- Browser smoke and live API smoke are optional, with no evidence of execution in the harness bundle. Do not claim real-browser or real-Stockfish coverage from the 31 passing deterministic tests.

## Proposed architecture

```text
tests/
  rules/                # legal positions, move history, terminal conditions, FEN/SAN/UCI
  classification/       # expected-points boundaries and special-category precedence
  tactics/              # attack, defense, material, forced vs conditional outcomes
  explanations/         # semantic fact validation and text rendering
  arrows/               # evidence -> overlay and orientation correctness
  continuation/         # legal PV, dynamic stopping, summaries, state restoration
  invariants/           # repetition, perspective and board-orientation metamorphisms
  full_games/           # PGN-based end-to-end fixtures and per-ply comparisons
  adversarial/          # malicious, misleading and edge-case fixtures
  browser/              # Playwright interaction, layout, accessibility, visuals
  mutations/            # intentionally broken code variants and detection tests
fixtures/
  positions/            # minimal FEN+history+move+oracle assertions
  games/                # PGNs and independently checked per-ply ground truth
  negative_controls/    # tempting but false pin/fork/sacrifice examples
  reference_engine/     # immutable position analyses with provenance
  chesscom/             # externally observed labels and confidence/provenance
  opening_books/        # fixed opening corpus and version metadata
reports/
  generated/            # failure artifacts; exclude from normal git commits
scripts/
  run-fast.cjs
  run-engine.py
  run-browser.cjs
  audit-snapshots.cjs
  mutation-check.cjs
```

Long term, the best architectural change is to extract pure analysis functions behind a stable interface: `classifyMove(context)`, `detectTacticalFacts(context)`, `chooseExplanation(facts)`, `buildArrows(facts)`, `buildExplainLine(context)`. The DOM should not be the source of truth for any chess fact. This can happen incrementally without an immediate rewrite of `ui.js`.

## Canonical fixture contract

Each position fixture should contain:

- Immutable `id`, issue link, short description and game/ply provenance.
- `startingFEN`, **full legal move history** or PGN up to the position, current turn, played move as UCI, expected SAN, resulting FEN.
- Raw engine evidence: before/after evaluation (normalized to one color), MultiPV, candidate-move search if applicable, search depth/nodes/time, WDL/mate score, original UCI score, options, binary and NNUE hash.
- Structured tactical evidence: pieces attacked, legal defenders, safe captures, exchanged material, forced responses, static-exchange checks, candidate defenses, response lines and adjudicated conclusion.
- `required_claims`, `forbidden_claims`, arrow origins/targets/roles, prohibited phantom arrows, expected UI state.
- Classification expectations (`required`, `allowed_set`, or `unverified`), source quality and uncertainty. **Never place an uncertain human guess in `required`.**
- `evidence_status`, reviewer, review date, fixture version and change history.

Suggested typed shape (illustrative only):

```json
{
  "id": "TAC-FALSE-PIN-001",
  "position": {
    "fen": "4k2r/8/1q6/8/3n1p2/8/5B2/6K1 w - - 0 1",
    "history_uci": [],
    "played_uci": "f2e3"
  },
  "oracle": {"level": "rules_verified", "engine_ref": null},
  "assertions": {
    "forbid_tactical_claims": ["effective_pin_on_d4_to_b6"],
    "forbid_arrows": [{"from": "e3", "to": "b6", "role": "pin"}],
    "allow_plain_description": true
  },
  "triage": {"status": "reviewed", "issue": "FALSE_PIN_RECAPTURE"}
}
```

`history_uci: []` is valid only for a standalone example with no history-sensitive claims. PGN-derived fixtures MUST preserve full history. Do not rely on four-field FEN equivalence for claimed repetitions or 50/75-move rules.

## Verification layer 1 — Rule and state oracle

Prefer python-chess for independent legal-state verification against frontend chess.js; use exact UCI/SAN and full FEN or move stack. Assert:

- Same number of plies, legal SAN/UCI, FEN after each move, side to move, captures, check, checkmate, stalemate, insufficient material, promotion, en passant, castling rights.
- Correct evaluation POV: scores normalized before comparison; distinguish cp, mate, WDL, and genuinely terminal game results.
- Threefold/fivefold repetition and claimable/automatic draw rights depend on **history**, not board layout alone. Include 50/75-move halfmove clocks; adjudicate available rights rather than assuming a loss estimate is enough.
- Defensive cases: check evasions, pinned moves, underpromotions, multiple equally good legal replies, perpetual check, fortresses and zugzwang.
- Inputs: malformed PGNs, invalid FEN, missing engine, timeout, incomplete evaluations, interrupted requests and huge games are handled without silent invented output.

## Verification layer 2 — Move-quality model

**Separate numerical quality from special labels**. First compute normalized expected-points change and the position's evaluated best moves; then apply explicit, ordered, versioned rules for `Book`, `Miss`, `Great`, and `Brilliant`. Store both numeric loss and the override reason, not only the resulting label.

Chess.com's Classification V2 published intervals as of February 2026: Excellent <=0.02, Good 0.02–0.05, Inaccuracy 0.05–0.10, Mistake 0.10–0.20, Blunder >=0.20, with Best and special categories handled separately. Boundaries and ties must be unambiguous in our implementation; test values immediately below, exactly at, and immediately above 0.02/0.05/0.10/0.20. Rating-dependent expected-points conversion and Chess.com's special rules are not fully exposed; distinguish imitation from proven correctness.

High-value tests:

- Same input, same engine snapshot, same model version => same label independent of searched username, board orientation or arbitrary player-display metadata.
- `expected points lost` cannot improve due to changing UI category, formatting, selected tab, or board orientation.
- No top-three-PV rank requirement for Excellent unless an explicitly defended classifier rule warrants it. Do not treat MultiPV rank as the only oracle for Best.
- Baseline and played moves near thresholds are checked with higher-budget search or uncertainty flag; no accidental knife-edge green test from shallow evaluation.
- Distinguish a missed forced mate from a +13 centipawn position; mate-score truncation must never camouflage a serious Miss.
- Repeated identical state+history+move under a fixed analysis profile is stable. When history differs (claimable draw, repetition), equal first-four-field FEN need not imply equal quality.
- Rating may affect special categories if **the model deliberately includes rating**; searched-user identity must never change the facts.
- For calibrated Chess.com likeness, compare per-ply disagreement matrices, not only totals. A swapped Inaccuracy/Mistake can cancel in aggregate counts while both positions remain wrong.

## Verification layer 3 — Tactical facts and claims

Treat each claim as a typed object with evidence, certainty, targets, alternatives and arrows:

`CaptureFact`, `ThreatFact`, `PinFact`, `ForkFact`, `DiscoveredAttackFact`, `CheckFact`, `MaterialOutcomeFact`, `MateFact`, `PositionalFact`, `ConditionalPVFact`.

Use an evidence ladder:

- **Observed**: the move captures a piece, gives check, moves a defender, develops a piece, attacks a square.
- **Locally verified**: legal attacks, immediate recaptures, discovered attack, a legal alternative, material balance before/after.
- **Engine-supported conditional**: a tactical idea occurs in one or several explored continuations; say “can,” “threatens,” or “in this line.”
- **Strongly established**: all relevant defensive responses examined to a sufficient resolution; appropriate to say “wins material” or “forces.”
- **Proof-like terminal/tablebase**: legal checkmate or exact eligible endgame-tablebase outcome; still qualify material claims if the line is one among alternatives.

Strict negative cases for each motif:

- Fork: two targets geographically attacked but attacker immediately lost without sufficient return; opponent can take knight; one target is protected; true checking fork where king *must* respond and rook falls versus merely threatened rook.
- Pin: geometric ray with immediate counter-capture, queen behind a less valuable piece but no real constraint, absolute king pin versus relative material pin, piece can legally respond, attacker is en prise.
- Discovered attack: mover not direct attacker; rays are blocked, alleged revealed victim can capture or evade, queen-versus-rook priority reversed.
- Material: even exchange falsely called “free piece”; material is gained in only one PV; compensation comes from mate/positional factors rather than immediate count; underpromotions, pawn structure and defenders.
- Priority: direct hanging queen/rook or forced tactical line outranks a minor positional pin; choose at most a small number of useful arrows, no decorative arrows on routine moves.

**For “forced” claims**, do not mistake a single engine PV for a proof. Enumerate legal replies at the critical forcing nodes; use sound tactical filters to prioritize candidate defenses, targeted root-move engine checks and deeper analysis where needed. State bounded confidence when the tree is not exhaustive. Never claim a guaranteed rook if a legal defense avoids it. For positional claims, prefer measured language over synthetic certainty.

## Verification layer 4 — Brilliant and Great

Two opposing fixture families are essential:

1. **Good sacrifices**: a near-best move deliberately gives up a piece or initiates a material sacrifice; strong counterplay persists under the opponent's best defenses; the player is not merely winning regardless; verify nonobvious continuation and game context. The `14...Nxc3` IQSNIPPY game is a **high-priority candidate**, but do not assert Brilliant until its complete PGN, pre-move position, engine profiles, and defensive alternatives are verified.
2. **Bad or ordinary sacrifices**: a sacrifice that wins only against a blunder, an obvious forced recapture, a move that was losing already, a completely winning side making routine concessions, and a shallow engine misrank. These must not be classed Brilliant.

Critical distinctions:

- The fact that Stockfish initially did not rank a move first does **not** prove the move brilliant.
- A tactic subsequently succeeds in the played game does **not** prove it was sound against best play.
- A sacrifice's tactical potential and its objective value should be stored separately. A colorful insight can say “sets a tactical trap” without overclaiming a forced outcome.
- “Great” should have its own tests for only-good-move/criticality/turning points; don't allow Brilliant detection to swallow Great, Best or other labels.
- Pin engine parameters and annotate ambiguous candidates as `UNVERIFIED` rather than shaping thresholds until they pass.

## Verification layer 5 — Continuation and explanation mode

Explicit state machine:

`GAME -> EXPLAIN_START -> EXPLAIN_STEP_1...N -> EXPLAIN_END -> GAME`.

Invariants:

- Explain is opt-in and only offered when meaningful verified continuation evidence exists; no automatic stepping or spurious button on every book/quiet move.
- Entering Explain snapshots complete game state: ply, FEN, orientation, evaluation POV, selected tab, move highlight, arrow set and scroll positions where appropriate.
- Each proposed PV move is legal from the actual current variation FEN; SAN, highlights, arrows and explanatory claims reference the variation, not the original game.
- Dynamic stop criteria: tactical point resolved, advantage stabilized, mate/draw reached, forced exchange completed, insufficient trustworthy PV or configurable safety cap; do not truncate solely at an arbitrary 5 plies.
- End-of-line summary distinguishes **material gained in that line**, **engine evaluation** and **proven outcome**; it must never claim guaranteed improvement from one sample PV.
- Got it (including early exit) restores exact original state, does not contaminate actual move list, and keeps the bright green prominent button.
- Reopening, switching tabs, rapid navigation, back, keyboard navigation and route changes do not leave stale explanation state.

## Verification layer 6 — Arrows and visual claims

Generate arrow specifications from **verified tactical fact IDs**, not directly from sentence templates. Test:

- Origin/target are valid board squares, correspond to actual piece/square relationships, and point in the proper direction; discovered attacks may originate from a third piece, but must prove that piece exists and its ray is unblocked.
- Arrows and narration reference the same actor, target and tactical significance.
- Inverting board orientation preserves semantic from/to squares and only changes pixel coordinate mapping.
- If a knight threatens a queen *and* a rook, arrow selection reflects legal threat priority and discovered protection; don't show phantom “protects queen” arrows when no relevant threat exists.
- All overlay arrows stay anchored during viewport resize, mobile rotation, zoom, scrolling and panel expansion.
- Bad move overlays show the opponent's meaningful reply or missed opportunity, not a random best-move arrow divorced from the explanation.

## Metamorphic and property-based testing

Instead of only fixed expected screenshots, generate many legal chess states and transformations with reproducible random seeds:

- Perspective swap and board flip: same chess analysis output for the same game, only presentation changes.
- Save/load PGN, UCI/SAN roundtrip, apply/undo a legal move sequence, and compare normalized boards/history.
- Serializing and replaying a continuation yields the same move sequence and FEN; illegal continuation is truncated.
- Same exact position/history/engine snapshot/model version yields same classification on repeated calls; first-four-field FEN equality alone is **not** enough.
- Every tactical arrow refers to real pieces and a consistent role; no arrow marked `capture` may point to an empty square unless representing a prospective move with explicit semantics.
- No text contains a direct guaranteed-result claim without an attached evidence object meeting its required level.

Use property-based fuzzing for legal states; retain shrinking and seeds for any failure. Supplement with mutation testing: deliberately invert perspective, misclassify every move as Excellent, disable a capture validation, reverse arrow endpoints, hard-cap explanation length, or corrupt Got it state. The suite **must** catch each injected defect.

## Browser and end-to-end contracts

Run Playwright against a seeded backend and a deterministic analyzed game (not Chess.com live). At minimum cover desktop 1440x900, compact desktop 1024x768, tablet 900x900, mobile 390x844 and 320x568, 200% zoom, light/dark if supported, keyboard-only operation, portrait/landscape and long narrative text.

Check with DOM geometry **and** visual snapshots:

- Insight text, button and line selector never clip or overlap the move pane; description is fully visible without scrolling an *insight-only* subpanel (when text is too long for constrained viewport, use overall appropriate page/layout scrolling rather than overlapping UI).
- Vertical centering of Explain move chips, nav controls and Got it; button sizes, border contrast and semantic focus visibility.
- Explain button exists only when deserved and remains clickable; Got it is prominent and returns to same actual position.
- No horizontal viewport overflow, phantom double topbar or duplicate insight box; responsive board navigation remains functional.
- Screenshots are compared on pinned browser/OS/fonts to avoid platform-induced noise. Semantic/geometry tests are primary, snapshots supplement them.
- Browser errors, missing dependencies, delayed backend responses, canceled analyses, restarted Stockfish, invalid usernames and oversized game records surface graceful states, not a stuck spinner.

## Corpus and source reliability

Initial named cases: Freyz10, Fadil11220, HarrisonTheWonderful, auakiev, ocampeon (existing aggregate screenshots); IQSNIPPY knight-sacrifice and repeated checks; Mlody_27's discovered attack, queen defense and pin priority; caig2drinks' blunder explanations; extra exact tactical FENs already in v1. Add full PGNs/per-ply exported labels when available. Do **not** fabricate missing PGNs from screenshots.

Oracle hierarchy:

1. **Exact rule outcomes:** legality, mate, checked tablebase status (eligible positions), capture existence.
2. **Human-reviewed tactical truths with engine evidence:** pin, fork, soundness, forcing vs optional.
3. **Pinned engine benchmark:** objective evaluation/near-best status at declared search profile; sensitive results tagged for escalation.
4. **External Chess.com per-ply reference:** calibration target with device/date/strength provenance; not a proof of tactics.
5. **Aggregate screenshot totals:** coarse diagnostic only, never an independent per-ply correctness oracle.

For controversial examples, two reviewers or separate methods should agree before freezing a high-confidence expectation. Changes to expected labels need a rationale; don't just regenerate snapshots until green.

## CI lanes and release gates

| Lane | Trigger | Includes | Blocking expectation |
|---|---|---|---|
| Fast | Every commit/PR | v1 + rule-state + fixed-oracle classifier/tactics/explanation tests; seed fuzz | Zero failures on verified invariants |
| Engine | Classifier/tactic changes, nightly | pinned Stockfish; full PGNs; critical counterplay; threshold analysis; cross-depth diagnostic | Zero unsupported tactical claims in verified corpus; no unreviewed high-severity regression |
| Browser | UI changes/PR | Playwright real browser and state/geometry; visual review | Zero clipping, broken navigation or state restoration in target viewports |
| Adversarial | Nightly/weekly | mutation tests, fuzz, negative controls, backend fault injection | Known injected defects detected; no critical crash |
| Calibration | On demand/nightly | Chess.com per-ply confusion matrices, rating/accuracy drift | Report drift with provenance; no blind expectation that values exactly match |

For each failure, report `fixture id -> actual label -> expected status -> eval and PV -> violated facts -> arrows -> screenshot/trace`. Have explicit categories `PASS`, `FAIL`, `KNOWN_FAIL`, `UNVERIFIED`, `SKIPPED`; only `PASS` counts toward verified coverage. Unverified high-impact claims block enabling the specific feature, not necessarily the entire unrelated application.

## Recommended rollout sequence

1. **Freeze the baseline.** Commit current app and v1 harness; document exact source version and engine settings. Establish a v2 branch. Do not fix classifier thresholds yet.
2. **Create a fixture registry + trust model.** Add IDs for every historical bug, attach only evidence actually available, and separate verified from candidate expectations. Build a small validator that rejects malformed fixtures.
3. **Make red tests from known defects.** Nxc3 candidate (subject to independent review), fake pins, deceptive forks, repeated Nf5+, false forced-material claims, arrow mismatches, missing Explain and UI clipping. Current unresolved bugs should be conspicuous.
4. **Create independent Python oracle.** Verify moves, history, terminal results, material changes, tactical preconditions, and legal PVs. Feed truth to JS tests without asking the production JS functions for the answer.
5. **Refactor one seam at a time.** Extract structured tactical facts and category reasons before rendering text/arrows. No full frontend rewrite required.
6. **Introduce pinned real-engine lane.** Recompute a small adjudicated corpus, escalate close-threshold positions, compare analysis profiles and track engine variation; freeze expected benchmark outputs with provenance.
7. **Add full-game and metamorphic tests.** Start with complete real games, then fuzz legal states, perspective swaps and undo/redo paths.
8. **Add browser interactions and geometry contracts.** Validate Explain and Got it, arrows, responsive layouts, dynamic heights and visual changes.
9. **Run mutation testing.** Prove the harness detects precisely the errors that used to pass.
10. **Review and expand.** Every new reported defect becomes a minimal permanent fixture; publish coverage by feature and confidence, not just test count.

## Acceptance checklist before Phase 2

- All verified rule and data invariants pass; every known bug either has a passing regression or a visible failing/blocked test.
- Every displayed high-impact claim type has an evidence requirement and negative-control tests. No unverified `forced mate`, `forced win`, `free piece`, `fork`, `pin`, `brilliant` labels released silently.
- Same game, same engine profile and model version => identical per-ply quality and insight semantics from either user's page and either board orientation.
- Explanation mode only appears intentionally, plays only legal variations, and Got it restores state exactly.
- Move labels, explanations and arrows share the same verified tactical facts; no independent contradictory generators.
- Visual tests for representative desktop/mobile heights pass, with no clipping or obscured controls.
- Calibration report includes per-ply confusion matrix and source provenance, not only category totals.
- Mutation tests detect intentional false labels, false arrows, lost state and illegal PV defects.

## Public technical references (as of Nov. 2026)

- Chess.com Classification V2: https://support.chess.com/en/articles/8572705-how-are-moves-classified-what-is-a-blunder-or-brilliant-etc
- Chess.com Game Review: https://support.chess.com/en/articles/8584089-how-does-game-review-work
- python-chess engine API: https://python-chess.readthedocs.io/en/stable/engine.html
- Stockfish FAQ on Threads, Hash and MultiPV: https://official-stockfish.github.io/docs/stockfish-wiki/Stockfish-FAQ.html
- Playwright visual comparisons: https://playwright.dev/docs/test-snapshots
- Hypothesis property-based testing: https://hypothesis.readthedocs.io/en/latest/tutorial/introduction.html
