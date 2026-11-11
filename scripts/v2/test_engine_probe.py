#!/usr/bin/env python3
"""Contract/negative-control tests for the opt-in v2.1 UCI evidence adapter.

These use a fake engine *only* to check adapter fail-closed behavior. They do NOT
count as actual Stockfish observations. Real engine evidence uses engine_probe.py.
"""
from __future__ import annotations
import tempfile
import unittest
from pathlib import Path

import chess
import chess.engine

import engine_probe


class FakeEngine:
    def __init__(self, corrupt: str | None = None):
        self.corrupt = corrupt

    def analyse(self, board, limit, **kwargs):
        root_moves = kwargs.get("root_moves")
        chosen = root_moves[0] if root_moves else next(iter(board.legal_moves))
        if self.corrupt == "ignore_root" and root_moves:
            chosen = next(move for move in board.legal_moves if move != chosen)
        if self.corrupt == "illegal_pv":
            chosen = chess.Move.from_uci("a1a8")
        return {"score": chess.engine.PovScore(chess.engine.Cp(50), chess.WHITE),
                "pv": [chosen], "depth": 7, "nodes": limit.nodes}


class EngineEvidenceContract(unittest.TestCase):
    def test_curated_inputs_are_legally_checkable(self):
        cases = engine_probe.load_curated()
        self.assertEqual([c["id"] for c in cases],
                         ["ENGINE-PAWN-RECAPTURE-001", "ENGINE-FALSE-PIN-001"])
        for case in cases:
            self.assertIn(case["played"], case["board"].legal_moves)

    def test_valid_engine_info_yields_legal_pv(self):
        case = engine_probe.load_curated()[0]
        result = engine_probe.run_case(FakeEngine(), case, nodes=1500)
        self.assertEqual(result["played_forced_from_before"]["root_move"], case["played"].uci())
        self.assertEqual(result["known_defense_forced"]["root_move"], case["defense"].uci())
        self.assertEqual(result["best_from_before"]["score"]["pov"], "white")

    def test_illegal_engine_pv_fails_closed(self):
        case = engine_probe.load_curated()[0]
        with self.assertRaisesRegex(ValueError, "illegal Stockfish PV move"):
            engine_probe.run_case(FakeEngine(corrupt="illegal_pv"), case, nodes=1500)

    def test_engine_ignoring_forced_root_fails_closed(self):
        case = engine_probe.load_curated()[0]
        with self.assertRaisesRegex(ValueError, "forced root"):
            engine_probe.run_case(FakeEngine(corrupt="ignore_root"), case, nodes=1500)

    def test_missing_engine_is_not_skipped_as_pass(self):
        with self.assertRaisesRegex(ValueError, "Stockfish executable not found"):
            engine_probe.choose_engine("/deliberately/nonexistent/stockfish-unavailable")

    def test_pgn_extraction_requires_exact_fullmove_and_san(self):
        # Synthetic parser test only. This is NOT the missing historical game.
        pgn = ('[Event "Synthetic parser test"]\n'
               '[White "TestPlayer"]\n'
               '[Black "IQSNIPPY"]\n'
               '[Result "*"]\n\n'
               '1. d4 Nf6 2. Nc3 e6 3. e4 Nd5 4. h3 a6 5. a3 b6 6. b3 c6 '
               '7. g3 Be7 8. Bg2 O-O 9. Nge2 d6 10. O-O Nd7 11. f3 Bb7 '
               '12. Kh2 Qc7 13. Rb1 Rae8 14. Qd3 Nxc3 *\n')
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "synthetic.pgn"
            path.write_text(pgn, encoding="utf-8")
            candidate = engine_probe.load_iqsnippy(path)
        self.assertEqual(candidate["played"].uci(), "d5c3")
        self.assertEqual(len(candidate["board"].move_stack), 27)
        self.assertEqual(candidate["board"].fullmove_number, 14)
        self.assertEqual(candidate["board"].turn, chess.BLACK)
        self.assertEqual(candidate["case_type"], "historical_unverified")

    def test_no_iqsnippy_pgn_cannot_be_upgraded(self):
        with self.assertRaisesRegex(ValueError, "PGN does not exist"):
            engine_probe.load_iqsnippy(engine_probe.ROOT / "missing-iqsnippy-game.pgn")


if __name__ == "__main__":
    unittest.main(verbosity=2)
