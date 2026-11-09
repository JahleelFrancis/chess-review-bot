/*
 * Chess Review Bot — tactical evidence (phase 1)
 * No move-quality, accuracy, or rating changes in this module.
 * This module intentionally distinguishes a visible ATTACK from a FORCED gain.
 * Requires chess.js loaded first. Supports both window.Chess and a top-level Chess
 * binding (the user's vendor chess.js exports Chess lexically, not on window).
 */
(function (root) {
  'use strict';
  // Some browser builds of chess.js declare a top-level `class Chess` without
  // setting window.Chess. That class is accessible to scripts as Chess, but
  // checking only root.Chess silently disables this module.
  const ChessCtor = typeof root.Chess === 'function'
    ? root.Chess
    : (typeof Chess === 'function' ? Chess : null);
  const PIECE_VALUES = Object.freeze({ p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 });
  const FILES = 'abcdefgh';
  const DIRS = Object.freeze({
    b: [[1,1],[1,-1],[-1,1],[-1,-1]],
    r: [[1,0],[-1,0],[0,1],[0,-1]],
    q: [[1,1],[1,-1],[-1,1],[-1,-1],[1,0],[-1,0],[0,1],[0,-1]],
  });
  const value = (p) => PIECE_VALUES[typeof p === 'string' ? p : p?.type] || 0;
  const other = (c) => c === 'w' ? 'b' : 'w';
  const validSquare = (sq) => typeof sq === 'string' && /^[a-h][1-8]$/.test(sq);
  const square = (f, r) => f >= 0 && f < 8 && r >= 1 && r <= 8 ? FILES[f] + r : null;
  const createBoard = (fen) => new ChessCtor(fen);
  const legalMoves = (board) => board.moves({ verbose: true }) || [];
  function play(board, move) {
    try {
      const m = typeof move === 'string'
        ? { from: move.slice(0,2), to: move.slice(2,4), ...(move.length > 4 ? { promotion: move[4] } : {}) }
        : { from: move.from, to: move.to, ...(move.promotion ? { promotion: move.promotion } : {}) };
      return board.move(m) || null;
    } catch (_) { return null; }
  }
  function attacks(board, sq, piece) {
    if (!piece || !validSquare(sq)) return [];
    const f = FILES.indexOf(sq[0]);
    const r = Number(sq[1]);
    if (piece.type === 'n') {
      return [[1,2],[2,1],[-1,2],[-2,1],[1,-2],[2,-1],[-1,-2],[-2,-1]]
        .map(([dx,dy]) => square(f+dx,r+dy)).filter(Boolean);
    }
    if (piece.type === 'p') {
      const dy = piece.color === 'w' ? 1 : -1;
      return [-1,1].map(dx => square(f+dx,r+dy)).filter(Boolean);
    }
    if (piece.type === 'k') {
      return [[1,1],[0,1],[-1,1],[1,0],[-1,0],[1,-1],[0,-1],[-1,-1]]
        .map(([dx,dy]) => square(f+dx,r+dy)).filter(Boolean);
    }
    const result = [];
    for (const [dx,dy] of DIRS[piece.type] || []) {
      for (let n=1; n<=7; n++) {
        const target = square(f+dx*n, r+dy*n);
        if (!target) break;
        result.push(target);
        if (board.get(target)) break;
      }
    }
    return result;
  }

  // Best net gain in a legal recapture chain on *one square*, where each
  // player may stop exchanging. Unlike a single 'is defended' flag, it handles
  // multiple recaptures, checks/pins and legal-king constraints via chess.js.
  // This is STATIC exchange analysis, not a substitute for deep Stockfish search.
  function bestRecaptureGain(board, targetSquare, limit = 10, cache = new Map()) {
    if (limit <= 0 || !board.get(targetSquare)) return 0;
    const key = `${board.fen()}|${targetSquare}|${limit}`;
    if (cache.has(key)) return cache.get(key);
    const victim = board.get(targetSquare);
    let best = 0; // declining the recapture is always an option
    for (const candidate of legalMoves(board)) {
      if (candidate.to !== targetSquare || !candidate.captured) continue;
      const next = createBoard(board.fen());
      if (!play(next, candidate)) continue;
      const pawnPromotionBonus = candidate.promotion ? value(candidate.promotion) - 1 : 0;
      const gain = value(victim) + pawnPromotionBonus -
        bestRecaptureGain(next, targetSquare, limit - 1, cache);
      best = Math.max(best, gain);
    }
    cache.set(key, best);
    return best;
  }
  function captureGain(boardAfterCapture, move) {
    if (!move?.captured) return null;
    const promotionBonus = move.promotion ? value(move.promotion) - 1 : 0;
    return value(move.captured) + promotionBonus -
      bestRecaptureGain(boardAfterCapture, move.to);
  }
  function removability(boardAfter, sq) {
    const attackingPiece = boardAfter.get(sq);
    if (!attackingPiece) return { removable: false, captures: [] };
    const candidates = legalMoves(boardAfter)
      .filter(m => m.to === sq && Boolean(m.captured));
    const captures = candidates.map(m => {
      const next = createBoard(boardAfter.fen());
      if (!play(next, m)) return null;
      return { from: m.from, to: m.to, net: captureGain(next, m) };
    }).filter(Boolean);
    // If they can exchange the attacker at even value or better, the attack
    // is not a sound stand-alone tactical threat (sacrifices need a PV check).
    return { removable: captures.some(m => m.net >= 0), captures };
  }
  function isBetween(a,b,c) {
    if (![a,b,c].every(validSquare)) return false;
    const af = FILES.indexOf(a[0]), ar = +a[1];
    const bf = FILES.indexOf(b[0]), br = +b[1];
    const cf = FILES.indexOf(c[0]), cr = +c[1];
    const dx = cf-af, dy = cr-ar;
    if (!(dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy))) return false;
    const sf = Math.sign(dx), sr = Math.sign(dy);
    for (let f=af+sf, r=ar+sr; f!==cf || r!==cr; f+=sf, r+=sr) {
      if (f===bf && r===br) return true;
    }
    return false;
  }
  function pinnedPieceCanLeaveRay(board, pin) {
    const pinned = pin.between;
    const p = pinned.piece;
    if (!p || p.type === 'k') return false;
    const destinations = p.type === 'p'
      ? pawnPseudoDestinations(board, pinned.square, p)
      : attacks(board, pinned.square, p).filter(s => board.get(s)?.color !== p.color);
    const leaving = destinations.filter(s => s !== pin.attacker &&
      !isBetween(pin.attacker, s, pin.behind.square));
    if (!leaving.length) return false;
    const legal = new Set(legalMoves(board).filter(m => m.from === pinned.square).map(m=>m.to));
    // Absolute pin: at least one *geometrically possible* move is illegal.
    if (pin.behind.piece.type === 'k') return leaving.some(s => !legal.has(s));
    // Relative pin: legal mobility exists but it uncovers a MORE valuable piece.
    return value(pin.behind.piece) > value(p) && leaving.some(s => legal.has(s));
  }
  function pawnPseudoDestinations(board, from, pawn) {
    const f = FILES.indexOf(from[0]), r = +from[1];
    const dy = pawn.color==='w' ? 1 : -1;
    const result = [];
    const one = square(f,r+dy);
    if (one && !board.get(one)) {
      result.push(one);
      const two = square(f,r+dy*2);
      if (r === (pawn.color==='w' ? 2 : 7) && two && !board.get(two)) result.push(two);
    }
    for (const dest of attacks(board,from,pawn)) {
      if (board.get(dest)?.color === other(pawn.color)) result.push(dest);
    }
    return result;
  }
  function pinFrom(board, sq, piece) {
    if (!(DIRS[piece?.type] || []).length) return null;
    const f=FILES.indexOf(sq[0]), r=+sq[1];
    for (const [dx,dy] of DIRS[piece.type]) {
      let between = null;
      for (let n=1; n<=7; n++) {
        const target = square(f+dx*n,r+dy*n);
        if (!target) break;
        const current = board.get(target);
        if (!current) continue;
        if (current.color === piece.color) break;
        if (!between) {
          if (current.type==='k') break;
          between={ square:target,piece:current };
          continue;
        }
        if (['k','q','r'].includes(current.type)) {
          const pin = { attacker:sq, between, behind:{square:target,piece:current} };
          if (pinnedPieceCanLeaveRay(board,pin)) return pin;
        }
        break;
      }
    }
    return null;
  }
  function discoveredAttack(before, after, move) {
    for (const f of FILES) for (let r=1;r<=8;r++) {
      const source=f+r, piece=after.get(source), prior=before.get(source);
      if (!piece || !prior || source===move.to ||
          piece.color!==move.color || prior.color!==piece.color ||
          piece.type!==prior.type || !(DIRS[piece.type] || []).length) continue;
      const old=new Set(attacks(before,source,piece));
      for (const target of attacks(after,source,piece)) {
        const victim=after.get(target);
        if (!victim || victim.color===move.color || old.has(target) ||
            !['k','q','r'].includes(victim.type) ||
            !isBetween(source,move.from,target)) continue;
        return {attacker:{square:source,piece},victim:{square:target,piece:victim}};
      }
    }
    return null;
  }
  function robustFork(after, move, protectedByCapture) {
    const attacker=after.get(move.to);
    if (!attacker || protectedByCapture) return null;
    const targets=attacks(after,move.to,attacker)
      .map(sq => ({ square:sq,target:after.get(sq) }))
      .filter(o => o.target && o.target.color!==move.color && o.target.type!=='p')
      .filter(o => o.target.type!=='k' || /[+#]/.test(move.san || ''))
      .map(o => ({ ...o, targetValue:value(o.target) }))
      .filter(o => o.target.type==='k' || o.targetValue >= 5 ||
        (o.targetValue > value(attacker) && !attacks(after,o.square,o.target).includes(move.to)))
      .sort((a,b) => b.targetValue-a.targetValue);
    if (targets.length < 2 || !targets.some(o => ['k','q','r'].includes(o.target.type))) return null;

    let forcedMaterialWin = null;
    if (targets.some(o => o.target.type==='k') && /[+#]/.test(move.san || '')) {
      // Verify a rook/queen cannot escape *across all legal check responses*.
      const materialTargets = targets.filter(o => ['r','q'].includes(o.target.type));
      const replies=legalMoves(after);
      if (materialTargets.length && replies.length && replies.length<=40) {
        let minimumGain=Infinity, guaranteedTarget=null;
        for (const reply of replies) {
          const responseBoard=createBoard(after.fen());
          if (!play(responseBoard, reply)) continue;
          let best=0, bestSq=null;
          for (const potential of materialTargets) {
            if (responseBoard.get(potential.square)?.color !== other(move.color)) continue;
            for (const response of legalMoves(responseBoard)) {
              if (response.from!==move.to || response.to!==potential.square || !response.captured) continue;
              const next=createBoard(responseBoard.fen());
              if (!play(next,response)) continue;
              const gain=captureGain(next,response);
              if (gain>best) {best=gain; bestSq=potential.square;}
            }
          }
          if (best<minimumGain) {minimumGain=best;guaranteedTarget=bestSq;}
        }
        if (Number.isFinite(minimumGain) && minimumGain>=2 && guaranteedTarget) {
          forcedMaterialWin = { minimumGain, target: guaranteedTarget };
        }
      }
    }
    return { targets, forcedMaterialWin, isCheckFork:targets.some(o=>o.target.type==='k') };
  }
  function analyzeMove(fen, uci) {
    if (typeof ChessCtor !== 'function' || !fen || !uci) return null;
    try {
      const before=createBoard(fen);
      const after=createBoard(fen);
      const move=play(after,uci);
      if (!move) return null;
      const piece=after.get(move.to);
      if (!piece) return null;
      const canTake=removability(after,move.to);
      const fork=robustFork(after,move,canTake.removable);
      const pin=canTake.removable ? null : pinFrom(after,move.to,piece);
      const discovery=discoveredAttack(before,after,move);
      const oldAttacks = new Set(attacks(before,move.from,before.get(move.from)));
      const threats=attacks(after,move.to,piece).map(sq=>({ square:sq,target:after.get(sq) }))
        .filter(o=>o.target && o.target.color!==piece.color && value(o.target)>=3)
        .map(o=>({ ...o, fresh:!oldAttacks.has(o.square) }));
      return {
        uci, san:move.san, side:move.color, afterFen:after.fen(),
        check:/[+#]/.test(move.san||''),
        capture:move.captured ? {victim:move.captured, netExchangeGain:captureGain(after,move)} : null,
        attackerCanBeTaken:canTake.removable,
        pin, fork, discovered:discovery, threats,
      };
    } catch (e) { return null; }
  }
  root.ChessTactics=Object.freeze({analyzeMove, captureGain, bestRecaptureGain, attacks});
})(typeof window!=='undefined' ? window : globalThis);
