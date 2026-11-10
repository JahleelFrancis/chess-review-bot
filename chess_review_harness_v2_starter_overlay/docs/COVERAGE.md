# Issue-to-test traceability and next fixtures

| Historical issue / edge case | Guard today | Remaining work before calling it solved |
|---|---|---|
| Black had too few Excellents / too many Goods; rank-of-PV and extreme-win bias | `03` perspective invariance, `06` category comparison report | Real move-by-move labels + actual engine evaluations for these games. Test that top-three rank alone never incorrectly decides Excellent. |
| Too many Bests / depth and MultiPV changes | `06` drift report; `07` deterministic long review | Pin Stockfish executable+options in run metadata; evaluate with at least two depths in controlled benchmarking; do not hardcode totals. |
| Opening book counts too high (5 vs 4, 5 vs 2) and eventual opening name recognition | `07` empty-book late-move case | Snapshot lookup with known `bookMap`; separate opening ECO/name from `book` move category, test book transpositions and book exit/re-entry. |
| Perspective/user bias | `03` same raw input different searched player; snapshot `--compare` | Export the same real game viewed from both accounts and assert per-ply label and summary invariance. |
| Inaccuracy/Mistake/Miss/Blunder vs Chess.com | Raw finite losses and `06` reference drift | Save per-ply Chess.com review labels and repeat with controlled engine version; decisions on mate transitions and winning cleanup. |
| Repeated checks classified inconsistently (20.Nf5+ vs 22.Nf5+) | `03` real logged FEN and raw EP-loss values | Capture repetition-history-specific examples; compare threefold repetition and 50/75-move rights. |
| Mate-0 gets wrong signed eval; forced mate missed | `01` mate-0 winner, `04` check text | Add terminal FEN fixtures for checkmate, stalemate, forced mate-in-N, and mate score sign flips across MultiPV. |
| Defended knight forks, false 'free material' claims, pins that aren't tactically meaningful | `02` king+rook checking fork and fallback | Save FEN+UCI for attacked but defended knight, pseudo-pin pawn, pinned knight revealing a rook, discovered attack. Assertions should verify legal captures across replies, not just geometric attacks. |
| Directly threatened queen/rook should outrank positional pawn-pin insight | `02` correct fork arrows; snapshot arrow coordinate validation | Attach tactical-ground-truth assertions for 14.Ndf3 / 14...Nxf3 / 15.Nxf3 / queen pressure, including SAN, boards and expected arrows. |
| Queen capture defended knight, discovered attack, and recapture mistaken for 'wins piece' | `02` legal exchange evidence | Add exact FENs for queen capture defending knight and exchanges that only maintain balance. |
| Missed hanging piece vs blunder allowing tactic | `04` engine PV legality, `06` legal game snapshot | Per-move annotated explanation fixtures: include move, alternative, forced reply, material and whether loss is causal. |
| Sacrificed knight Nxc3 might be Brilliant; later ...Bxc3+ forks K/R | `02` forced check fork | Capture game PGN and original stockfish PV at 14...Nxc3. Analyze all credible replies; test robust sacrifice compensation. Mark expected brilliant only after evidence is verified. |
| Fake 'pin' from rook to pawn/king or bishop pinned to something behind it | `02` partial fork safeguards | Semantic FEN fixtures for pin type, protected piece, legal king moves, attacker capture, exchange sequence. |
| Move summaries overpromise 'engine approved' / pseudo-forced wins | `04` checked summary uncertainty | Compare all generated claims against observable position, scored continuation; add golden text assertions for specific verified tactics. |
| Explain only shows up sometimes, vanishes, starts without request, or changes actual ply | `04` optional entry and exact restoration; `05` structural UI | Browser smoke on at least one game with explanatory lines and one without; test switching tabs mid-explanation. |
| Dynamic continuation length, illegal PV, changing move list, end-of-line summary | `04` variable PV and summary; `06` PV audit | Add cases for mate after one ply, quiet strategic lines, material-equal positional cases, terminal positions and alternate PVs. |
| Explain box clips into moves, hard to see border, wrong button colors / sizes / alignment | `05` stylesheet checks, optional browser smoke | Manual screenshot baseline at phone/tablet/desktop; test active explanation buttons, green Got it visibility, and 200% zoom. |
| Responsive layout and app source performance | Optional Playwright 3 viewports | Add accessibility and keyboard tests, phone rotate, iOS Safari, slow device, app navigation away/back. |

## Gates

**Gate A (blocking, every commit):** all `node --test` checks green; static frontend loads; no illegal SAN/FEN; perspective invariance; explanation and Got it restore exact state. Keep these strict.

**Gate B (blocking on classifier changes):** at least 10 complete *real-game* snapshots (both low and high rated) and a minimum 30 hand-reviewed tactical positions, covering both colors. Every known disagreement must be logged with FEN, UCI, raw eval, PV and expected teaching text. A changed calibration is reviewed, not silently accepted.

**Gate C (blocking on tactical explanation / Brilliant rollout):** every use of 'forced wins material', 'fork', 'pin', 'discovered attack' or 'brilliant sacrifice' requires corresponding legal evidence, not just a high Stockfish eval or a geometric attack. Prefer a conservative but true insight over a dramatic false one.

**Gate D (blocking on desktop/mobile layout):** Playwright check on 1440×900, 900×900, 390×844, plus manual browser/device snapshots at smaller heights; no coach/moves overlap, no unintentional sideways scroll, visible Got it.

## What to add next

For each exact example, store `{FEN before, UCI played, legal SAN, FEN after, raw evaluations and MultiPV, reference classification (if verified), arrows expected, claims allowed, claims disallowed}` as a JSON fixture. For forced tactics store legal opponent responses and the minimum net outcome; do **not** call the first PV 'forced' unless alternatives have been checked. This makes every past bug a permanent test instead of a memory of a screenshot.
