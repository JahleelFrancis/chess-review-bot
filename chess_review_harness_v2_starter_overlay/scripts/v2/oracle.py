#!/usr/bin/env python3
"""Independent chess-rule verification for curated v2 fixtures.

The production UI uses chess.js. This checker uses python-chess instead.
This script does NOT certify Stockfish soundness or Brilliant classifications.
"""
from __future__ import annotations
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
FIXTURES = ROOT / 'fixtures' / 'v2' / 'positions.json'

try:
    import chess
except ImportError:
    print('UNVERIFIED: python-chess is missing; install python-chess==1.999 and rerun.', file=sys.stderr)
    sys.exit(2)


def square(name: str) -> chess.Square:
    return chess.parse_square(name)


def verify_ray(board: chess.Board, ray: dict) -> None:
    a, b, c = [square(ray[k]) for k in ('from', 'blocker', 'behind')]
    assert (chess.between(a, c) & chess.BB_SQUARES[b]), 'blocking piece must be on the ray'
    assert chess.between(a, c) & board.occupied == chess.BB_SQUARES[b], 'exactly one piece must block the ray'
    attacker = board.piece_at(a)
    assert attacker is not None and attacker.piece_type in (chess.BISHOP, chess.ROOK, chess.QUEEN)
    assert b in board.attacks(a), 'attacker must attack the blocking piece'
    blocker, behind = board.piece_at(b), board.piece_at(c)
    assert blocker and blocker.symbol().lower() == ray['blocker_type']
    assert behind and behind.symbol().lower() == ray['behind_type']
    assert blocker.color != attacker.color and behind.color == blocker.color


def verify_one(row: dict) -> None:
    position = row['position']
    assert position is not None
    if 'start_fen' in position:
        b = chess.Board(position['start_fen'])
        for item in position['history_uci']:
            m = chess.Move.from_uci(item)
            assert m in b.legal_moves, f'illegal historical move: {item}'
            b.push(m)
        assert b.is_valid(), 'invalid final board'
        if 'can_claim_threefold_repetition' in row['oracle']:
            assert b.can_claim_threefold_repetition() == row['oracle']['can_claim_threefold_repetition']
        return

    b = chess.Board(position['fen'])
    assert b.is_valid(), 'invalid starting board'
    # Standalone FEN fixtures do not claim historical repetition or draw rights.
    assert position['history_uci'] == [], 'historical games require a start_fen and complete history'
    uci = position['played_uci']
    m = chess.Move.from_uci(uci)
    assert m in b.legal_moves, f'{uci} is not a legal move'
    assert b.san(m) == position['expected_san'], 'SAN mismatch'
    before = b.copy(stack=True)
    mover_color = b.turn
    b.push(m)
    assert b.fen() == position['expected_after_fen'], 'resulting full FEN mismatch'

    oracle = row['oracle']
    if 'opponent_can_capture_mover' in oracle:
        actual = any(move.to_square == m.to_square and b.is_capture(move) for move in b.legal_moves)
        assert actual == oracle['opponent_can_capture_mover'], 'recapture availability mismatch'
    if 'legal_opponent_recapture' in oracle:
        r = chess.Move.from_uci(oracle['legal_opponent_recapture'])
        assert r in b.legal_moves and b.is_capture(r) and r.to_square == m.to_square
    if 'checking_move' in oracle:
        assert b.is_check() == oracle['checking_move'], 'check status mismatch'
    if 'ray' in oracle:
        verify_ray(b, oracle['ray'])
    for attack in oracle.get('attacks_after', []):
        assert square(attack['to']) in b.attacks(square(attack['from'])), f'no attack {attack}'
    if 'uncovered_attack' in oracle:
        v = oracle['uncovered_attack']
        a, target = square(v['from']), square(v['to'])
        assert before.is_attacked_by(mover_color, target) == v['before']
        assert b.is_attacked_by(mover_color, target) == v['after']
        assert target in b.attacks(a), 'uncovered line must originate from declared piece'


def main() -> int:
    data = json.loads(FIXTURES.read_text(encoding='utf-8'))
    assert data['schema_version'] == '2.0.0'
    ids, passed, failed, unverified = set(), 0, 0, 0
    for row in data['fixtures']:
        ident = row['id']
        if ident in ids:
            print(f'FAIL: duplicate ID {ident}')
            failed += 1
            continue
        ids.add(ident)
        if row['evidence_status'] == 'unverified':
            unverified += 1
            print(f'UNVERIFIED: {ident} (not counted as passing)')
            continue
        if row['evidence_status'] != 'rules_verified':
            failed += 1
            print(f'FAIL: {ident}: unknown evidence status')
            continue
        try:
            verify_one(row)
            passed += 1
            print(f'PASS: {ident}')
        except Exception as ex:
            failed += 1
            print(f'FAIL: {ident}: {type(ex).__name__}: {ex}')
    print(f'\nIndependent rule oracle: {passed} PASS, {failed} FAIL, {unverified} UNVERIFIED')
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main())
