#!/usr/bin/env python3
"""Opt-in, real-Stockfish evidence lane. Never upgrades candidate labels to PASS.

Requires python-chess and a *real* Stockfish binary. Records reproducibility
metadata and validates the legality of every reported principal variation.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys

ROOT = Path(__file__).resolve().parents[2]
REGISTRY = ROOT / "fixtures" / "v2" / "positions.json"
CASES = ROOT / "fixtures" / "v2" / "engine-cases.json"
DEFAULT_OUTPUT = ROOT / "artifacts" / "v2-engine" / "latest.json"
WINDOWS_ENGINE = ROOT / "stockfish" / "stockfish-windows-x86-64-avx2" / "stockfish" / "stockfish-windows-x86-64-avx2.exe"

try:
    import chess
    import chess.engine
    import chess.pgn
except ImportError:
    print("FAIL: python-chess is missing. Install: python -m pip install -r requirements-test-v2.txt", file=sys.stderr)
    sys.exit(2)


def require(ok: bool, message: str) -> None:
    if not ok:
        raise ValueError(message)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def choose_engine(value: str | None) -> Path:
    given = value or os.environ.get("CHESS_STOCKFISH")
    if given:
        candidate = Path(given).expanduser().resolve()
    elif WINDOWS_ENGINE.is_file():
        candidate = WINDOWS_ENGINE
    else:
        found = shutil.which("stockfish")
        candidate = Path(found) if found else WINDOWS_ENGINE
    require(candidate.is_file(), f"Stockfish executable not found at {candidate}; use --engine PATH or CHESS_STOCKFISH")
    return candidate


def load_curated() -> list[dict]:
    manifest = json.loads(CASES.read_text(encoding="utf-8"))
    registry = json.loads(REGISTRY.read_text(encoding="utf-8"))
    require(manifest["schema_version"] == "2.1.0", "unknown engine case schema")
    require(registry["schema_version"] == "2.0.0", "unknown rule fixture schema")
    lookup = {r["id"]: r for r in registry["fixtures"]}
    rows = []
    ids = set()
    for item in manifest["cases"]:
        ident = item["id"]
        require(ident not in ids, f"duplicate engine case: {ident}")
        ids.add(ident)
        source = lookup[item["rule_fixture_id"]]
        require(source["evidence_status"] == "rules_verified", f"{ident}: source fixture not verified")
        pos = source["position"]
        require(pos and "fen" in pos and not pos["history_uci"], f"{ident}: only standalone FENs currently supported")
        board = chess.Board(pos["fen"])
        require(board.is_valid(), f"{ident}: invalid starting position")
        played = chess.Move.from_uci(pos["played_uci"])
        require(played in board.legal_moves, f"{ident}: illegal played move")
        require(board.san(played) == pos["expected_san"], f"{ident}: SAN mismatch")
        after = board.copy(stack=True)
        after.push(played)
        require(after.fen() == pos["expected_after_fen"], f"{ident}: resulting FEN mismatch")
        defense = chess.Move.from_uci(item["defense_uci"])
        require(defense in after.legal_moves, f"{ident}: declared defense is illegal")
        if item["defense_type"] == "immediate_recapture":
            require(after.is_capture(defense) and defense.to_square == played.to_square,
                    f"{ident}: defense is not an immediate recapture")
        else:
            raise ValueError(f"{ident}: unsupported defense type")
        rows.append({"id": ident, "source": item["rule_fixture_id"], "board": board,
                     "played": played, "defense": defense, "case_type": "curated"})
    require(len(rows) >= 2, "engine lane must contain at least two independent curated cases")
    return rows


def load_iqsnippy(pgn_file: Path) -> dict:
    """Extract historical 14...Nxc3 by *complete move history*, not by guessing a FEN."""
    require(pgn_file.is_file(), f"PGN does not exist: {pgn_file}")
    with pgn_file.open("r", encoding="utf-8-sig") as stream:
        game = chess.pgn.read_game(stream)
    require(game is not None and not game.errors, "PGN missing or contains parsing errors")
    require(game.board().fen() == chess.STARTING_FEN,
            "Historical case requires a complete PGN starting from the normal initial position")
    players = [game.headers.get("White", ""), game.headers.get("Black", "")]
    require(any(p.casefold() == "iqsnippy" for p in players),
            "PGN must identify IQSNIPPY in the White or Black header")
    board = game.board()
    matches = []
    for move in game.mainline_moves():
        san = board.san(move)
        if board.fullmove_number == 14 and board.turn == chess.BLACK and san.rstrip("+#") == "Nxc3":
            matches.append((board.copy(stack=True), move))
        board.push(move)
    require(len(matches) == 1, f"Expected exactly one legal 14...Nxc3, got {len(matches)}")
    before, played = matches[0]
    require(len(before.move_stack) == 27, "14...Nxc3 requires all 27 preceding half-moves")
    return {"id": "BRILL-IQSNIPPY-001", "source": "local_pgn_14...Nxc3",
            "board": before, "played": played, "defense": None, "case_type": "historical_unverified"}


def score_white(info: dict) -> dict:
    require("score" in info, "Stockfish returned no score")
    score = info["score"].white()
    if score.is_mate():
        return {"type": "mate", "value": score.mate(), "pov": "white"}
    cp = score.score()
    require(cp is not None, "centipawn evaluation was missing")
    return {"type": "cp", "value": cp, "pov": "white"}


def analyze(engine, board: chess.Board, nodes: int, forced: chess.Move | None = None) -> dict:
    require(bool(list(board.legal_moves)), "cannot search terminal board")
    if forced is not None:
        require(forced in board.legal_moves, "forced root move is illegal")
    # A fresh game marker per search sends ucinewgame to reduce cross-case hash contamination.
    info = engine.analyse(board, chess.engine.Limit(nodes=nodes),
                          root_moves=[forced] if forced else None,
                          game=object(), info=chess.engine.INFO_ALL)
    require(isinstance(info, dict), "single-PV analysis did not return a record")
    pv = list(info.get("pv") or [])
    require(bool(pv), "Stockfish returned no principal variation")
    if forced is not None:
        require(pv[0] == forced, f"forced root {forced.uci()} missing from PV")
    replay = board.copy(stack=True)
    san = []
    for i, move in enumerate(pv):
        require(move in replay.legal_moves, f"illegal Stockfish PV move at {i}: {move.uci()}")
        san.append(replay.san(move))
        replay.push(move)
    require(int(info.get("nodes", 0)) > 0, "Stockfish did not report searched nodes")
    require(int(info.get("depth", 0)) > 0, "Stockfish did not report search depth")
    return {"score": score_white(info), "depth": int(info["depth"]),
            "nodes": int(info["nodes"]), "pv_uci": [m.uci() for m in pv],
            "pv_san": san, "pv_final_fen": replay.fen(),
            "root_move": pv[0].uci()}


def run_case(engine, row: dict, nodes: int) -> dict:
    board = row["board"]
    move = row["played"]
    before_fen = board.fen()
    played_san = board.san(move)
    best = analyze(engine, board, nodes)
    played = analyze(engine, board, nodes, forced=move)
    after = board.copy(stack=True)
    after.push(move)
    result = {"id": row["id"], "source": row["source"],
              "evidence_status": "ENGINE_OBSERVATION_NOT_CLASSIFICATION_TRUTH",
              "before_fen": before_fen,
              "history_uci": [m.uci() for m in board.move_stack],
              "played_uci": move.uci(),
              "played_san": played_san, "after_fen": after.fen(),
              "best_from_before": best, "played_forced_from_before": played,
              "best_defense_after_played": analyze(engine, after, nodes)}
    if row["defense"] is not None:
        defense = row["defense"]
        result["known_legal_defense"] = defense.uci()
        result["known_defense_forced"] = analyze(engine, after, nodes, forced=defense)
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--engine", help="Stockfish executable; defaults to CHESS_STOCKFISH or backend Windows path")
    parser.add_argument("--nodes", type=int, default=25000, help="Fixed nodes per search, minimum 1000")
    parser.add_argument("--out", type=Path, default=DEFAULT_OUTPUT, help="Where to write JSON evidence")
    parser.add_argument("--iqsnippy-pgn", type=Path, help="Local full-game PGN; analyze 14...Nxc3 without certifying Brilliant")
    parser.add_argument("--require-sha256", help="Fail if engine binary hash differs from expected pinned SHA-256")
    args = parser.parse_args()
    try:
        require(args.nodes >= 1000, "--nodes must be at least 1000")
        engine_path = choose_engine(args.engine)
        engine_hash = sha256(engine_path)
        if args.require_sha256:
            require(engine_hash.lower() == args.require_sha256.lower(), "engine binary SHA-256 mismatch")
        cases = load_curated()
        if args.iqsnippy_pgn:
            cases.append(load_iqsnippy(args.iqsnippy_pgn))
        print(f"Stockfish evidence lane: {len(cases)} cases, {args.nodes} nodes per search")
        with chess.engine.SimpleEngine.popen_uci(str(engine_path), timeout=60.0) as engine:
            name = str(engine.id.get("name", ""))
            require("stockfish" in name.lower(), f"engine is not identified as Stockfish: {name}")
            for option in ("Threads", "Hash"):
                require(option in engine.options, f"Stockfish lacks required UCI option: {option}")
            engine.configure({"Threads": 1, "Hash": 16})
            nnue = {key: engine.options[key].default for key in ("EvalFile", "EvalFileSmall") if key in engine.options}
            results = []
            for case in cases:
                result = run_case(engine, case, args.nodes)
                results.append(result)
                print(f"PASS engine evidence: {case['id']} | best={result['best_from_before']['root_move']} "
                      f"played={result['played_uci']}")
            profile = {"engine_name": name, "engine_author": engine.id.get("author", ""),
                       "engine_binary_sha256": engine_hash, "engine_binary_name": engine_path.name,
                       "python_chess_version": chess.__version__,
                       "uci_options": {"Threads": 1, "Hash": 16, "MultiPV": 1, **nnue},
                       "limit": {"nodes_per_search": args.nodes},
                       "score_pov": "white", "pv_validation": "every move independently legal via python-chess"}
        record = {"schema_version": "2.1.0", "status": "ENGINE_OBSERVATIONS_COMPLETE",
                  "not_verified": ["Brilliant classification", "forced tactical gain", "Chess.com label parity",
                                   "IQSNIPPY sacrifice soundness without independent reviewer"],
                  "rules_registry_sha256": sha256(REGISTRY), "engine_cases_sha256": sha256(CASES),
                  "source_pgn_sha256": sha256(args.iqsnippy_pgn) if args.iqsnippy_pgn else None,
                  "profile": profile, "cases": results}
        args.out.parent.mkdir(parents=True, exist_ok=True)
        args.out.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
        print(f"PASS: {len(results)} engine observations saved to {args.out}")
        print("UNVERIFIED: The IQSNIPPY Brilliant designation and four historical candidates remain open.")
        return 0
    except (OSError, ValueError, KeyError, AssertionError, chess.engine.EngineError,
            chess.engine.EngineTerminatedError, TimeoutError) as exc:
        print(f"FAIL engine evidence: {type(exc).__name__}: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
