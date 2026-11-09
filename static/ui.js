/*
  ui.js
  Contextual move-quality tuning: stricter opening book, winning-side forgiveness, and competitive/high-rated strictness.

  ui.js
  -----
  Now with Opening Book support and Expected Points classification.
*/


// Identifies which frontend build is actually loaded in the browser.
// Run CHESS_TACTICS_UI_VERSION in the developer console after hard-refreshing.
window.CHESS_TACTICS_UI_VERSION = '2026-11-04-consistency-explain-v1';

const QUALITY_STYLES = {
  brilliant: { color: "#26c6da", label: "Brilliant" },
  great: { color: "#6aa9ff", label: "Great" },
  book: { color: "#c99a63", label: "Book" },
  best: { color: "#7bd66f", label: "Best" },
  excellent: { color: "#8bdc7c", label: "Excellent" },
  good: { color: "#b8c2d0", label: "Good" },
  inaccuracy: { color: "#f4c542", label: "Inaccuracy" },
  mistake: { color: "#ff9f43", label: "Mistake" },
  miss: { color: "#ff5f6d", label: "Miss" },
  blunder: { color: "#ff3b3b", label: "Blunder" },
};

// A checkmated position comes back from the engine as "mate 0", which has no
// sign. initAnalysisUI() tags those evals with `winner` so every consumer can
// tell who actually delivered mate (otherwise the mating move reads as a blunder).
function isMateForWhite(ev) {
  if (!ev) return false;
  if (ev.value === 0 && ev.winner) return ev.winner === "white";
  return ev.value > 0;
}

function formatMateLabel(ev) {
  return ev.value === 0 ? "#" : `M${Math.abs(ev.value)}`;
}

function normalizeTerminalMateEvals(result) {
  const fix = (ev, fen) => {
    if (!ev || ev.type !== "mate" || ev.value !== 0) return;
    const sideToMove = String(fen || "").split(" ")[1];
    // The side to move is the one that has been checkmated.
    ev.winner = sideToMove === "w" ? "black" : "white";
  };

  (result.evaluations || []).forEach((ev, i) => {
    const fen = result.fens?.[i];
    fix(ev, fen);
    (ev?.lines || []).forEach((line) => fix(line, fen));
  });
}

function getMoveSideFromIndex(index) {
  return index % 2 === 0 ? "white" : "black";
}

function findFirstMoveOfQuality(quality, side) {
  const qualities = window.moveQualities || window.analysisResult?.moveQualities || [];

  for (let i = 0; i < qualities.length; i++) {
    const q = qualities[i];

    if (!q) continue;

    const moveSide = getMoveSideFromIndex(i);

    if (q.type === quality && moveSide === side) {
      return i;
    }
  }

  return -1;
}

function jumpToQuality(quality, side) {
  const moveIndex = findFirstMoveOfQuality(quality, side);

  if (moveIndex === -1) {
    return;
  }

  jumpToMoveIndex(moveIndex);
}

function jumpToMoveIndex(moveIndex) {
  if (explanationSession) finishExplanation();
  const analysis = window.analysisResult;
  if (!analysis || !Array.isArray(analysis.fens)) return;

  // moveIndex is 0-based in moveQualities.
  // currentMoveIndex is FEN/ply based, so add 1.
  const targetPly = clamp(
    Number(moveIndex) + 1,
    0,
    window.maxIndex || analysis.fens.length - 1
  );

  window.currentMoveIndex = targetPly;

  if (window.boardApi && analysis.fens[targetPly]) {
    window.boardApi.position(analysis.fens[targetPly], true);
  }

  updateUI();

  if (targetPly === 0 || Number(moveIndex) <= 0) {
    requestAnimationFrame(resetMoveListScroll);
  }

  setActiveTab("moves");
  updateUI();
}

window.jumpToQuality = jumpToQuality;
window.jumpToMoveIndex = jumpToMoveIndex;


// --- State Management ---
// Phones: summary card ("overview"/"info") vs. board view ("moves").
// Must match the phone media query in styles.css (portrait phones and
// short landscape screens).
const PHONE_QUERY =
  "(max-width: 700px) and (orientation: portrait), " +
  "(orientation: landscape) and (max-height: 520px) and (max-width: 1180px)";

function isPhoneLayout() {
  return !!window.matchMedia && window.matchMedia(PHONE_QUERY).matches;
}

// Phones: leave the analysis and go back to the games list.
function exitAnalysisToGames() {
  if (window.__openedFromBrowse && history.length > 1) {
    history.back();
    return;
  }

  if (
    typeof window.pushBrowseHistory === "function" &&
    typeof applyAppState === "function" &&
    typeof buildBrowseState === "function"
  ) {
    window.pushBrowseHistory();
    applyAppState(buildBrowseState());
  }
}

function setActiveTab(tabName) {
  if (tabName !== 'moves' && explanationSession) finishExplanation();
  // CSS reads this to decide what a phone shows (body[data-tab="..."]).
  document.body.dataset.tab =
    tabName === "overview" || tabName === "info" ? tabName : "moves";

  // The move strip can't centre the active move while it is hidden
  if (tabName === "moves") {
    requestAnimationFrame(() => {
      if (typeof updateMoveRibbon === "function") updateMoveRibbon();
    });
  }

  const tabOverview = document.getElementById("tabOverview");
  const tabMoves = document.getElementById("tabMoves");
  const tabInfo = document.getElementById("tabInfo");

  const overviewPanel = document.getElementById("overviewPanel");
  const movesPanel = document.getElementById("movesPanel");
  const infoPanel = document.getElementById("infoPanel");

  const tabs = [tabOverview, tabMoves, tabInfo];
  const panels = [overviewPanel, movesPanel, infoPanel];

  tabs.forEach(tab => tab?.classList.remove("active"));
  panels.forEach(panel => panel?.classList.remove("active"));

  if (tabName === "overview") {
    tabOverview?.classList.add("active");
    overviewPanel?.classList.add("active");
  } else if (tabName === "info") {
    tabInfo?.classList.add("active");
    infoPanel?.classList.add("active");
  } else {
    tabMoves?.classList.add("active");
    movesPanel?.classList.add("active");
  }
}

function setViewMode(mode) {
  document.body.classList.remove("view-landing", "view-browse", "view-analysis");
  document.body.classList.add(`view-${mode}`);
  window.currentView = mode;
}

function showLandingMode() {
  const form = document.getElementById("usernameForm");

  setViewMode("landing");

  if (form) form.classList.remove("visible");

  clearArrows();
  window.hasExitedHero = false;
}

function showBrowseMode() {
  const form = document.getElementById("usernameForm");

  setViewMode("browse");

  if (form) form.classList.add("visible");

  clearArrows();

  const tabMoves = document.getElementById("tabMoves");
  if (tabMoves) tabMoves.disabled = true;

  setActiveTab("info");
  window.hasExitedHero = true;
}

function showAnalysisMode() {
  const form = document.getElementById("usernameForm");

  setViewMode("analysis");

  if (form) form.classList.add("visible");

  const tabMoves = document.getElementById("tabMoves");
  if (tabMoves) tabMoves.disabled = false;

  setActiveTab("moves");
  window.hasExitedHero = true;
}

function resizeBoardAfterLayout() {
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      if (window.boardApi && typeof window.boardApi.resize === "function") {
        window.boardApi.resize();
      }

      if (
        window.boardApi &&
        window.analysisResult &&
        window.analysisResult.fens?.length
      ) {
        window.boardApi.position(
          explanationSession
            ? (explanationSession.step
              ? explanationSession.steps[explanationSession.step - 1].after
              : explanationSession.startingFen)
            : window.analysisResult.fens[window.currentMoveIndex || 0],
          false
        );

        if (explanationSession) { displayExplanation(); return; }
        if (document.body.classList.contains("view-analysis") && window.moveQualities) {
          drawBestMoveArrow();
          const current = window.moveQualities[window.currentMoveIndex - 1];
          if (current?.uci) drawMoveQualityBadge(current.uci, current);
        }
      }
    });
  });
}

window.addEventListener("resize", resizeBoardAfterLayout);

function clearAnalysisState() {
  explanationSession = null;
  clearArrows();

  window.analysisResult = null;
  window.moveQualities = null;
  window.currentMoveIndex = 0;
  window.maxIndex = 0;
  window.selectedGamePGN = null;
  window.currentGameMeta = null;

  if (window.boardApi) window.boardApi.position("start", false);

  const tabMoves = document.getElementById("tabMoves");
  if (tabMoves) tabMoves.disabled = true;

  clearBoardPlayers();

  const moveList = document.getElementById("moveList");
  if (moveList) {
    moveList.innerHTML = `
      <div class="emptyState compact">
        <div class="emptyStateTitle">Choose a game to begin analysis</div>
        <div class="emptyStateText">
          Move-by-move review will appear here after you open a game.
        </div>
      </div>
    `;
  }

  for (const id of ["coachBubble", "panelCoachBubble"]) {
    const bubble = document.getElementById(id);
    if (bubble) bubble.innerHTML = "";
  }

  const moveRibbon = document.getElementById("moveRibbon");
  if (moveRibbon) moveRibbon.innerHTML = "";

  const analysis = document.getElementById("analysis");
  if (analysis) {
    analysis.innerHTML = `
      <div class="emptyState compact">
        <div class="emptyStateTitle">Game details will appear here</div>
        <div class="emptyStateText">
          Open a game to view metadata, PGN, and analysis context.
        </div>
      </div>
    `;
  }
}

window.setActiveTab = setActiveTab;
window.setViewMode = setViewMode;
window.showLandingMode = showLandingMode;
window.showBrowseMode = showBrowseMode;
window.showAnalysisMode = showAnalysisMode;
window.clearAnalysisState = clearAnalysisState;


function initialsFromName(name, fallback) {
  const v = String(name || "").trim();
  return v ? v.slice(0, 1).toUpperCase() : fallback;
}

function getSearchedPlayerColor() {
  const meta = window.currentGameMeta || {};
  const searched = String(
    window.currentUsernameDisplay || window.currentUsername || ""
  ).toLowerCase();

  if (meta.whiteUsername?.toLowerCase() === searched) return "white";
  if (meta.blackUsername?.toLowerCase() === searched) return "black";

  return "white";
}

function renderBoardPlayers() {
  const topName = document.getElementById("boardPlayerTopName");
  const bottomName = document.getElementById("boardPlayerBottomName");
  const topAvatar = document.getElementById("boardPlayerTopAvatar");
  const bottomAvatar = document.getElementById("boardPlayerBottomAvatar");

  const topLabel = document.getElementById("boardPlayerTopLabel");
  const bottomLabel = document.getElementById("boardPlayerBottomLabel");

  const meta = window.currentGameMeta || {};
  const searchedColor = getSearchedPlayerColor();

  const whiteText = meta.whiteUsername
    ? `${meta.whiteUsername}${meta.whiteRating ? ` (${meta.whiteRating})` : ""}`
    : "—";

  const blackText = meta.blackUsername
    ? `${meta.blackUsername}${meta.blackRating ? ` (${meta.blackRating})` : ""}`
    : "—";

  const whiteInitial = initialsFromName(meta.whiteUsername, "W");
  const blackInitial = initialsFromName(meta.blackUsername, "B");

  if (searchedColor === "white") {
    if (topLabel) topLabel.textContent = "BLACK";
    if (bottomLabel) bottomLabel.textContent = "WHITE";

    if (topName) topName.textContent = blackText;
    if (bottomName) bottomName.textContent = whiteText;
    if (topAvatar) topAvatar.textContent = blackInitial;
    if (bottomAvatar) bottomAvatar.textContent = whiteInitial;
  } else {
    if (topLabel) topLabel.textContent = "WHITE";
    if (bottomLabel) bottomLabel.textContent = "BLACK";

    if (topName) topName.textContent = whiteText;
    if (bottomName) bottomName.textContent = blackText;
    if (topAvatar) topAvatar.textContent = whiteInitial;
    if (bottomAvatar) bottomAvatar.textContent = blackInitial;
  }
}

window.getSearchedPlayerColor = getSearchedPlayerColor;

function clearBoardPlayers() {
  const topName = document.getElementById("boardPlayerTopName");
  const bottomName = document.getElementById("boardPlayerBottomName");
  const topAvatar = document.getElementById("boardPlayerTopAvatar");
  const bottomAvatar = document.getElementById("boardPlayerBottomAvatar");

  const topLabel = document.getElementById("boardPlayerTopLabel");
  const bottomLabel = document.getElementById("boardPlayerBottomLabel");

  if (topLabel) topLabel.textContent = "BLACK";
  if (bottomLabel) bottomLabel.textContent = "WHITE";

  if (topName) topName.textContent = "—";
  if (bottomName) bottomName.textContent = "—";
  if (topAvatar) topAvatar.textContent = "B";
  if (bottomAvatar) bottomAvatar.textContent = "W";
}

// --- Arrows & Visuals ---
let arrowSvg = null;
function initArrowOverlay() {
  const boardEl = document.getElementById("board");
  if (!boardEl) return null;
  const container = boardEl.parentElement;
  if (arrowSvg && arrowSvg.parentElement === container) return arrowSvg;
  arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  Object.assign(arrowSvg.style, { position: "absolute", top: "0", left: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "10" });
  container.appendChild(arrowSvg);
  return arrowSvg;
}

function clearArrows() {
  if (arrowSvg) while (arrowSvg.firstChild) arrowSvg.removeChild(arrowSvg.firstChild);
  clearMoveBadges();
}

function drawArrow(fromSq, toSq, color = "#ffaa44", options = {}) {
  const svg = initArrowOverlay();
  if (!svg) return;

  if (options.clear !== false) clearArrows();
  if (!/^[a-h][1-8]$/.test(fromSq || "") || !/^[a-h][1-8]$/.test(toSq || "")) return;

  const boardEl = document.getElementById("board");
  const boardRect = boardEl.getBoundingClientRect();
  const containerRect = svg.parentElement.getBoundingClientRect();
  const sqSize = boardRect.width / 8;

  const bLeft = boardRect.left - containerRect.left;
  const bTop = boardRect.top - containerRect.top;

  const orientation =
    window.boardApi && typeof window.boardApi.orientation === "function"
      ? window.boardApi.orientation()
      : "white";

  function squareCenter(square) {
    const file = square.charCodeAt(0) - 97;
    const rank = parseInt(square[1], 10) - 1;

    let col;
    let row;

    if (orientation === "black") {
      col = 7 - file;
      row = rank;
    } else {
      col = file;
      row = 7 - rank;
    }

    return {
      x: bLeft + col * sqSize + sqSize / 2,
      y: bTop + row * sqSize + sqSize / 2,
    };
  }

  const from = squareCenter(fromSq);
  const to = squareCenter(toSq);
  const markerId = `arrow-${Math.random().toString(36).slice(2)}`;

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.appendChild(defs);
  }

  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", markerId);
  marker.setAttribute("markerWidth", "8");
  marker.setAttribute("markerHeight", "8");
  marker.setAttribute("refX", "7");
  marker.setAttribute("refY", "4");
  marker.setAttribute("orient", "auto");

  const head = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  head.setAttribute("points", "0 0, 8 4, 0 8");
  head.setAttribute("fill", color);

  marker.appendChild(head);
  defs.appendChild(marker);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", from.x);
  line.setAttribute("y1", from.y);
  line.setAttribute("x2", to.x);
  line.setAttribute("y2", to.y);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "4");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("marker-end", `url(#${markerId})`);
  line.setAttribute("opacity", options.dashed ? "0.78" : "0.84");
  if (options.dashed) line.setAttribute("stroke-dasharray", "9 7");

  svg.appendChild(line);
}

function drawBestMoveArrow() {
  const selectedPly = window.currentMoveIndex - 1;

  if (selectedPly < 0 || !window.moveQualities?.[selectedPly]) {
    return clearArrows();
  }

  const q = window.moveQualities[selectedPly];
  clearArrows();

  // Strong moves: show the concrete idea, not an unrelated alternative.
  if (["book", "best", "excellent", "good", "great", "brilliant"].includes(q.type)) {
    const arrows = q.idea?.arrows || [];
    for (const arrow of arrows.slice(0, 2)) {
      drawArrow(arrow.from, arrow.to, arrow.color || "#7fc957", {
        clear: false,
        dashed: Boolean(arrow.dashed),
      });
    }
    return;
  }

  // Bad moves: teach the concrete mistake when the board/engine line supports
  // it. On the displayed post-move board, a punishment arrow belongs to the
  // opponent; a missed-capture arrow belongs to the player.
  if (
    q.severity === "blunder" ||
    q.severity === "mistake" ||
    q.severity === "inaccuracy" ||
    q.severity === "miss"
  ) {
    for (const arrow of (q.badMoveLesson?.arrows || []).slice(0, 2)) {
      drawArrow(arrow.from, arrow.to, arrow.color || "#ff4d5e", {
        clear: false,
        dashed: Boolean(arrow.dashed),
      });
    }

    return;
  }

}

// --- Move Quality Badges ---
function clearMoveBadges() {
  document.querySelectorAll(".move-quality-badge").forEach(el => el.remove());
}

function drawMoveQualityBadge(uci, quality) {
  clearMoveBadges();

  if (!uci || uci.length < 4 || !quality) return;

  const boardEl = document.getElementById("board");
  if (!boardEl) return;

  const container = boardEl.parentElement;
  const badge = document.createElement("div");
  badge.className = `move-quality-badge quality-${quality.type || quality.severity}`;

  const symbols = {
    book: "📖",
    best: "★",
    excellent: "👍",
    good: "✓",
    great: "!",
    brilliant: "!!",
    inaccuracy: "?!",
    mistake: "?",
    miss: "✕",
    blunder: "??",
  };

  badge.textContent =
    symbols[quality.type] ||
    symbols[quality.severity] ||
    "✓";

  const toSq = uci.slice(2, 4);
  const boardRect = boardEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const sqSize = boardRect.width / 8;

  const orientation =
    window.boardApi && typeof window.boardApi.orientation === "function"
      ? window.boardApi.orientation()
      : "white";

  const file = toSq.charCodeAt(0) - 97;
  const rank = parseInt(toSq[1], 10) - 1;

  const col = orientation === "black" ? 7 - file : file;
  const row = orientation === "black" ? rank : 7 - rank;

  badge.style.left = `${boardRect.left - containerRect.left + col * sqSize + sqSize * 0.62}px`;
  badge.style.top = `${boardRect.top - containerRect.top + row * sqSize + sqSize * 0.08}px`;

  container.appendChild(badge);
}

// --- Classification Logic ---

function getMaterialBalance(board) {
  const values = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 0,
  };

  let score = 0;
  const squares = board.board();

  for (const row of squares) {
    for (const piece of row) {
      if (!piece) continue;

      const value = values[piece.type] || 0;
      score += piece.color === "w" ? value : -value;
    }
  }

  return score;
}

function generateMoveInsight({ moveSan, quality, severity, evalLoss, evalGain, engineBest }) {
  if (quality === "book") {
    return {
      title: `${moveSan} is a book move`,
      text: "This follows known opening theory.",
    };
  }

  if (quality === "brilliant") {
    return {
      title: `${moveSan} is brilliant`,
      text: "Great tactical idea — this appears to sacrifice material while keeping a strong position.",
    };
  }

  if (quality === "great") {
    return {
      title: `${moveSan} is a great move`,
      text: "Nice find. This move improves your position and appears to win or pressure material.",
    };
  }

  if (quality === "best") {
    return {
      title: `${moveSan} is best`,
      text: "You found the engine’s top recommendation.",
    };
  }

  if (quality === "excellent") {
    return {
      title: `${moveSan} is excellent`,
      text: "Strong move. It keeps the position healthy with very little downside.",
    };
  }

  if (severity === "inaccuracy") {
    return {
      title: `${moveSan} is an inaccuracy`,
      text: engineBest
        ? `This is playable, but there was a slightly better option: ${engineBest}.`
        : "This slightly worsens your position.",
    };
  }

  if (severity === "mistake") {
    return {
      title: `${moveSan} is a mistake`,
      text: engineBest
        ? `This gives up too much. A better option was ${engineBest}.`
        : "This move worsens your position noticeably.",
    };
  }

  if (severity === "miss") {
    return {
      title: `${moveSan} is a miss`,
      text: engineBest
        ? `You missed a stronger opportunity. The engine preferred ${engineBest}.`
        : "You missed a chance to punish your opponent.",
    };
  }

  if (severity === "blunder") {
    return {
      title: `${moveSan} is a blunder`,
      text: engineBest
        ? `This causes a major drop. The best move was ${engineBest}.`
        : "This seriously damages your position.",
    };
  }

  if (evalGain > 100) {
    return {
      title: `${moveSan} is a good move`,
      text: "This improves your position.",
    };
  }

  return {
    title: `${moveSan} is solid`,
    text: "A reasonable move that keeps the game playable.",
  };
}

function adjustEstimatedRatingsByResult(whiteOverview, blackOverview) {
  const meta = window.currentGameMeta || {};

  const whiteWon = meta.whiteResult === "win";
  const blackWon = meta.blackResult === "win";

  if (!whiteWon && !blackWon) {
    whiteOverview.estimatedRating = roundEstimatedRating(whiteOverview.estimatedRating);
    blackOverview.estimatedRating = roundEstimatedRating(blackOverview.estimatedRating);
    return;
  }

  const winner = whiteWon ? whiteOverview : blackOverview;
  const loser = whiteWon ? blackOverview : whiteOverview;

  const accuracyGap = winner.accuracy - loser.accuracy;

  // Only force the winner higher if their accuracy was basically equal or better.
  // If the loser clearly played cleaner, let that show.
  if (accuracyGap > -2 && winner.estimatedRating < loser.estimatedRating) {
    const midpoint = (winner.estimatedRating + loser.estimatedRating) / 2;
    winner.estimatedRating = midpoint + 50;
    loser.estimatedRating = midpoint - 50;
  }

  // If loser had much better accuracy, they can have a higher game rating,
  // but do not let it get silly.
  if (accuracyGap <= -2 && loser.estimatedRating - winner.estimatedRating > 200) {
    loser.estimatedRating = winner.estimatedRating + 200;
  }

  winner.estimatedRating = roundEstimatedRating(winner.estimatedRating);
  loser.estimatedRating = roundEstimatedRating(loser.estimatedRating);
}

function fenPositionKey(fen) {
  return String(fen || "").split(" ").slice(0, 4).join(" ");
}

function pieceValue(pieceType) {
  const values = {
    p: 1,
    n: 3,
    b: 3,
    r: 5,
    q: 9,
    k: 100,
  };

  return values[pieceType] || 0;
}

function moveObjectFromUci(uci) {
  if (!uci || uci.length < 4) return null;

  const moveObj = {
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
  };

  if (uci.length >= 5) {
    moveObj.promotion = uci[4];
  }

  return moveObj;
}

function getLegalMoveFromUci(board, uci) {
  const moveObj = moveObjectFromUci(uci);

  if (!board || !moveObj) return null;

  try {
    return board.move(moveObj);
  } catch (e) {
    try {
      return board.move(uci, { sloppy: true });
    } catch (err) {
      return null;
    }
  }
}

/* Move ideas are grounded in the actual board, and optionally in Stockfish's
   continuation. This is deliberately a small, explainable motif detector:
   it never labels a speculative plan as a forced tactic. */
const IDEA_FILES = "abcdefgh";
const IDEA_CENTER = ["d4", "e4", "d5", "e5"];
const IDEA_PIECE_NAMES = {
  p: "pawn", n: "knight", b: "bishop",
  r: "rook", q: "queen", k: "king",
};

function describeVerboseMoveInEnglish(move) {
  if (!move) return null;
  const san = String(move.san || "");
  const side = move.color === "b" ? "Black" : "White";
  if (/^O-O-O/.test(san)) return `${side} castles queenside`;
  if (/^O-O/.test(san)) return `${side} castles kingside`;

  const name = IDEA_PIECE_NAMES[move.piece] || "piece";
  const captured = IDEA_PIECE_NAMES[move.captured] || "piece";
  if (move.promotion) {
    const promotion = IDEA_PIECE_NAMES[move.promotion] || "piece";
    return move.captured
      ? `The pawn captures the ${captured} on ${move.to} and promotes to a ${promotion}`
      : `The pawn promotes to a ${promotion} on ${move.to}`;
  }
  if (move.captured) {
    return `The ${name} captures the ${captured} on ${move.to}`;
  }
  if (move.piece === "p") return `The pawn advances to ${move.to}`;
  if (["n", "b"].includes(move.piece) &&
      move.from[1] === (move.color === "w" ? "1" : "8")) {
    return `The ${name} develops to ${move.to}`;
  }
  return `The ${name} moves from ${move.from} to ${move.to}`;
}

function describeMoveInEnglishFromFen(fen, uci) {
  if (!fen || !uci) return null;
  try {
    const board = new Chess(fen);
    const move = getLegalMoveFromUci(board, uci);
    return describeVerboseMoveInEnglish(move);
  } catch (e) {
    return null;
  }
}

function describeBestOptionInEnglish(fen, uci) {
  if (!fen || !uci) return null;
  try {
    const board = new Chess(fen);
    const move = getLegalMoveFromUci(board, uci);
    if (!move) return null;
    const name = IDEA_PIECE_NAMES[move.piece] || "piece";
    if (/^O-O-O/.test(move.san || "")) return "to castle queenside";
    if (/^O-O/.test(move.san || "")) return "to castle kingside";
    if (move.captured) {
      const captured = IDEA_PIECE_NAMES[move.captured] || "piece";
      return `to capture the ${captured} on ${move.to} with the ${name}`;
    }
    if (move.promotion) {
      return `to promote the pawn on ${move.to}`;
    }
    return move.piece === "p"
      ? `to advance the pawn to ${move.to}`
      : `to move the ${name} from ${move.from} to ${move.to}`;
  } catch (e) {
    return null;
  }
}

function ideaSquare(file, rank) {
  return file >= 0 && file < 8 && rank >= 1 && rank <= 8
    ? `${IDEA_FILES[file]}${rank}`
    : null;
}

function ideaDirections(type) {
  const diagonals = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const straight = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (type === "b") return diagonals;
  if (type === "r") return straight;
  if (type === "q") return [...diagonals, ...straight];
  return [];
}

function squaresControlledBy(board, square, piece) {
  if (!square || !piece) return [];
  const file = IDEA_FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  if (file < 0 || !Number.isInteger(rank)) return [];

  if (piece.type === "n") {
    return [[1, 2], [1, -2], [-1, 2], [-1, -2],
      [2, 1], [2, -1], [-2, 1], [-2, -1]]
      .map(([df, dr]) => ideaSquare(file + df, rank + dr))
      .filter(Boolean);
  }

  if (piece.type === "p") {
    const advance = piece.color === "w" ? 1 : -1;
    return [-1, 1]
      .map(df => ideaSquare(file + df, rank + advance))
      .filter(Boolean);
  }

  if (piece.type === "k") {
    return [[1, 1], [1, 0], [1, -1], [0, 1],
      [0, -1], [-1, 1], [-1, 0], [-1, -1]]
      .map(([df, dr]) => ideaSquare(file + df, rank + dr))
      .filter(Boolean);
  }

  const attacked = [];
  for (const [df, dr] of ideaDirections(piece.type)) {
    for (let step = 1; step <= 7; step++) {
      const target = ideaSquare(file + df * step, rank + dr * step);
      if (!target) break;
      attacked.push(target);
      if (board.get(target)) break;
    }
  }
  return attacked;
}

// Enumerate moves that a pinned piece could make if king/queen exposure did
// not matter, but while keeping the actual board occupancy intact. In
// particular, a pawn cannot advance onto an enemy rook on its own file:
// removing the pinning rook to test mobility would invent a pawn move.
function pseudoDestinationsForPin(board, square, piece) {
  if (!piece || !square) return [];
  if (piece.type !== "p") {
    return squaresControlledBy(board, square, piece).filter(target => {
      const occupant = board.get(target);
      return !occupant || occupant.color !== piece.color;
    });
  }

  const file = IDEA_FILES.indexOf(square[0]);
  const rank = Number(square[1]);
  const direction = piece.color === "w" ? 1 : -1;
  const forward = ideaSquare(file, rank + direction);
  const possible = [];
  if (forward && !board.get(forward)) {
    possible.push(forward);
    const startRank = piece.color === "w" ? 2 : 7;
    const double = ideaSquare(file, rank + 2 * direction);
    if (rank === startRank && double && !board.get(double)) {
      possible.push(double);
    }
  }

  const enPassantSquare = String(board.fen?.() || "").split(" ")[3];
  for (const target of squaresControlledBy(board, square, piece)) {
    const occupant = board.get(target);
    if (occupant && occupant.color !== piece.color) {
      possible.push(target);
    } else if (!occupant && target === enPassantSquare) {
      const adjacentPawn = board.get(`${target[0]}${square[1]}`);
      if (adjacentPawn?.type === "p" && adjacentPawn.color !== piece.color) {
        possible.push(target);
      }
    }
  }
  return possible;
}

function pinActuallyRestricts(board, attackerSquare, pin) {
  const pinnedSquare = pin.between.square;
  const exposedSquare = pin.behind.square;
  const candidates = pseudoDestinationsForPin(board, pinnedSquare, pin.between.piece)
    .filter(target => target !== attackerSquare &&
      !isSquareBetweenOnLine(attackerSquare, target, exposedSquare));
  if (!candidates.length) return false;

  try {
    const legalDestinations = new Set(board.moves({ verbose: true })
      .filter(move => move.from === pinnedSquare)
      .map(move => move.to));

    if (pin.behind.piece.type === "k") {
      // Absolute pin: an otherwise possible move is illegal because it
      // exposes the king. If none existed, the 'pin' changes nothing.
      return candidates.some(target => !legalDestinations.has(target));
    }

    // Relative pin to the queen: moving away is legal, but would expose
    // the queen to capture. It only matters if the piece can actually move.
    return candidates.some(target => legalDestinations.has(target));
  } catch (e) {
    return false;
  }
}

function findMovePin(board, square, piece, requireMeaningful = false) {
  if (!ideaDirections(piece.type).length) return null;
  const file = IDEA_FILES.indexOf(square[0]);
  const rank = Number(square[1]);

  for (const [df, dr] of ideaDirections(piece.type)) {
    let between = null;
    for (let step = 1; step <= 7; step++) {
      const target = ideaSquare(file + df * step, rank + dr * step);
      if (!target) break;
      const occupant = board.get(target);
      if (!occupant) continue;
      if (occupant.color === piece.color) break;
      if (!between) {
        if (occupant.type === "k") break;
        between = { square: target, piece: occupant };
        continue;
      }
      if (occupant.type === "k" || occupant.type === "q") {
        const pin = { between, behind: { square: target, piece: occupant } };
        if (!requireMeaningful || pinActuallyRestricts(board, square, pin)) {
          return pin;
        }
      }
      break;
    }
  }
  return null;
}

// A geometric attack is not necessarily a tactic. If the opponent can legally
// take the attacking piece and at least trade evenly, don't call it a pin/fork.
// This intentionally errs on the side of *not* claiming a tactical motif.
function canNeutralizeAttackerByCapture(boardAfter, attackerSquare) {
  const attacker = boardAfter.get(attackerSquare);
  if (!attacker) return false;

  try {
    const captures = boardAfter.moves({ verbose: true }).filter(move =>
      move.to === attackerSquare && Boolean(move.captured));

    for (const capture of captures) {
      const replyBoard = new Chess(boardAfter.fen());
      const reply = replyBoard.move({
        from: capture.from,
        to: capture.to,
        promotion: capture.promotion,
      });
      if (!reply) continue;

      const recaptures = replyBoard.moves({ verbose: true }).filter(move =>
        move.to === attackerSquare && Boolean(move.captured));
      const possibleRecapture = recaptures.length > 0;

      // If there is a legal recapture, assume the defender can at least
      // exchange the pieces. A trade of equal value removes the attack.
      const netGainForOpponent = pieceValue(attacker.type) -
        (possibleRecapture ? pieceValue(reply.piece) : 0);
      if (netGainForOpponent >= 0) return true;
    }
  } catch (e) {
    // If exchanges cannot be checked reliably, suppress speculative tactics.
    return true;
  }

  return false;
}

function squareDefendedByColor(board, targetSquare, color) {
  for (const file of IDEA_FILES) {
    for (let rank = 1; rank <= 8; rank++) {
      const source = `${file}${rank}`;
      if (source === targetSquare) continue;
      const defender = board.get(source);
      if (defender?.color !== color) continue;
      if (squaresControlledBy(board, source, defender).includes(targetSquare)) {
        return true;
      }
    }
  }
  return false;
}

function materiallyUsefulForkTargets(board, attackingPiece, targets) {
  // A defended minor piece normally only trades for a knight. A rook or
  // queen is still worth winning even if the knight gets recaptured.
  return targets.filter(({ square, target }) => {
    if (target.type === "k") return true; // check must be answered
    const defended = squareDefendedByColor(board, square, target.color);
    const expectedGain = pieceValue(target.type) -
      (defended ? pieceValue(attackingPiece.type) : 0);
    return expectedGain > 0;
  });
}

function findMoveSkewer(board, square, piece) {
  if (!ideaDirections(piece.type).length) return null;
  const file = IDEA_FILES.indexOf(square[0]);
  const rank = Number(square[1]);

  for (const [df, dr] of ideaDirections(piece.type)) {
    let front = null;
    for (let step = 1; step <= 7; step++) {
      const target = ideaSquare(file + df * step, rank + dr * step);
      if (!target) break;
      const occupant = board.get(target);
      if (!occupant) continue;
      if (occupant.color === piece.color) break;
      if (!front) {
        if (!["k", "q"].includes(occupant.type)) break;
        front = { square: target, piece: occupant };
        continue;
      }
      if (pieceValue(occupant.type) >= 3 &&
          (front.piece.type === "k" ||
            pieceValue(front.piece.type) > pieceValue(occupant.type))) {
        return { front, behind: { square: target, piece: occupant } };
      }
      break;
    }
  }
  return null;
}

function isSquareBetweenOnLine(from, middle, to) {
  const fromFile = IDEA_FILES.indexOf(from[0]);
  const toFile = IDEA_FILES.indexOf(to[0]);
  const midFile = IDEA_FILES.indexOf(middle[0]);
  const fromRank = Number(from[1]);
  const toRank = Number(to[1]);
  const midRank = Number(middle[1]);
  const dx = toFile - fromFile;
  const dy = toRank - fromRank;
  if (!dx && !dy) return false;
  if (dx !== 0 && dy !== 0 && Math.abs(dx) !== Math.abs(dy)) return false;

  const stepFile = Math.sign(dx);
  const stepRank = Math.sign(dy);
  let file = fromFile + stepFile;
  let rank = fromRank + stepRank;
  while (file !== toFile || rank !== toRank) {
    if (file === midFile && rank === midRank) return true;
    file += stepFile;
    rank += stepRank;
  }
  return false;
}

function findDiscoveredAttack(before, after, move) {
  for (const file of IDEA_FILES) {
    for (let rank = 1; rank <= 8; rank++) {
      const square = `${file}${rank}`;
      if (square === move.to) continue;
      const piece = after.get(square);
      const previousPiece = before.get(square);
      if (!piece || piece.color !== move.color ||
          !ideaDirections(piece.type).length ||
          !previousPiece || previousPiece.color !== piece.color ||
          previousPiece.type !== piece.type) continue;

      const beforeControl = new Set(squaresControlledBy(before, square, piece));
      for (const target of squaresControlledBy(after, square, piece)) {
        const victim = after.get(target);
        if (!victim || victim.color === piece.color ||
            !["k", "q", "r"].includes(victim.type) ||
            beforeControl.has(target) ||
            !isSquareBetweenOnLine(square, move.from, target)) continue;
        return { attacker: { square, piece }, victim: { square: target, piece: victim } };
      }
    }
  }
  return null;
}

function describeControlledCenter(board, square, piece, name, isDevelopment = false) {
  const central = squaresControlledBy(board, square, piece)
    .filter(target => IDEA_CENTER.includes(target))
    .slice(0, 2);
  if (!central.length) return null;

  const supported = central.filter(target => board.get(target)?.color === piece.color);
  const pressured = central.filter(target => board.get(target)?.color !== piece.color);
  const parts = [];
  if (pressured.length) parts.push(`controls ${pressured.join(" and ")}`);
  if (supported.length) parts.push(`supports ${supported.join(" and ")}`);

  return {
    text: `${isDevelopment ? "Develops" : "Improves"} the ${name}'s activity: it ${parts.join(" and ")}.`,
    arrows: central.map(to => ({
      from: square, to, color: "#f4b84e",
    })),
  };
}

function findSupportedCentralPush(board, square, piece) {
  if (piece.type !== "p") return null;
  const advance = piece.color === "w" ? { home: "2", middle: "3", to: "4" }
    : { home: "7", middle: "6", to: "5" };
  const controlled = squaresControlledBy(board, square, piece)
    .filter(target => IDEA_CENTER.includes(target) && target[1] === advance.to)
    .sort((a, b) =>
      "edc".indexOf(a[0]) - "edc".indexOf(b[0]));

  for (const target of controlled) {
    const source = `${target[0]}${advance.home}`;
    const middle = `${target[0]}${advance.middle}`;
    const sourcePiece = board.get(source);
    if (!sourcePiece || sourcePiece.type !== "p" ||
        sourcePiece.color !== piece.color ||
        board.get(middle) || board.get(target)) continue;
    return {
      text: `Prepares a possible central pawn break on ${target}: the pawn on ${square} would support the ${target[0]}-pawn's advance.`,
      arrows: [
        { from: square, to: target, color: "#f4b84e" },
        { from: source, to: target, color: "#6aa0ff", dashed: true },
      ],
    };
  }
  return null;
}

function newlyProtectedAlly(before, after, move) {
  const original = before.get(move.from);
  const moved = after.get(move.to);
  if (!original || !moved) return null;

  const previouslyGuarded = new Set(squaresControlledBy(before, move.from, original));
  const opponentColor = move.color === "w" ? "b" : "w";
  const candidates = squaresControlledBy(after, move.to, moved)
    .map(square => ({ square, ally: after.get(square) }))
    .filter(({ square, ally }) => ally && ally.color === move.color &&
      ally.type !== "k" && square !== move.to && !previouslyGuarded.has(square))
    .map(candidate => ({
      ...candidate,
      underAttack: squareDefendedByColor(after, candidate.square, opponentColor),
    }))
    .sort((a, b) => Number(b.underAttack) - Number(a.underAttack) ||
      pieceValue(b.ally.type) - pieceValue(a.ally.type));

  // Don't call an incidental pawn defense a tactical idea. A newly guarded
  // minor/major piece or an already attacked pawn is worth explaining.
  return candidates.find(item => item.underAttack) ||
    candidates.find(item => pieceValue(item.ally.type) >= 3) || null;
}

function describeEngineLineMove(move) {
  const english = describeVerboseMoveInEnglish(move);
  if (!english) return null;
  return /^The /.test(english)
    ? `${move.color === "w" ? "White's" : "Black's"} ${english.slice(4).toLowerCase()}`
    : english;
}

function findFutureTacticalPoint(boardAfterFollow, follow) {
  const name = IDEA_PIECE_NAMES[follow.piece] || "piece";
  if ((follow.san || "").includes("#")) {
    return { text: `This continuation ends in checkmate.`, score: 10 };
  }
  const gain = materialWonOnCapture(boardAfterFollow, follow);
  if (gain >= 1) {
    return {
      text: `The ${name} wins material by taking the opposing ${IDEA_PIECE_NAMES[follow.captured] || "piece"}.`,
      score: gain,
    };
  }
  if (follow.promotion) {
    return { text: "The pawn reaches promotion in this line.", score: 5 };
  }

  const piece = boardAfterFollow.get(follow.to);
  if (!piece || canNeutralizeAttackerByCapture(boardAfterFollow, follow.to)) {
    return null;
  }

  const pin = findMovePin(boardAfterFollow, follow.to, piece, true);
  if (pin) {
    return {
      text: `The ${name} pins the ${IDEA_PIECE_NAMES[pin.between.piece.type]} to the ${IDEA_PIECE_NAMES[pin.behind.piece.type]}.`,
      target: pin.behind.square, score: 3,
    };
  }

  const targets = squaresControlledBy(boardAfterFollow, follow.to, piece)
    .map(square => ({ square, target: boardAfterFollow.get(square) }))
    .filter(({ target }) => target && target.color !== piece.color &&
      pieceValue(target.type) >= 3);
  const useful = materiallyUsefulForkTargets(boardAfterFollow, piece, targets)
    .sort((a, b) => pieceValue(b.target.type) - pieceValue(a.target.type));
  if (useful.length >= 2 &&
      useful.some(({ target }) => ["k", "q", "r"].includes(target.type))) {
    return {
      text: `The ${name} creates a ${follow.piece === "n" ? "fork" : "double attack"} against the ${IDEA_PIECE_NAMES[useful[0].target.type]} and ${IDEA_PIECE_NAMES[useful[1].target.type]}.`,
      target: useful[0].square, score: 4,
    };
  }
  const major = useful.find(({ target }) => ["q", "r"].includes(target.type));
  if (major) {
    return {
      text: `The ${name} threatens the opposing ${IDEA_PIECE_NAMES[major.target.type]} on ${major.square}.`,
      target: major.square, score: 2.5,
    };
  }
  return null;
}

function getEngineFollowUp(boardAfter, afterEvaluation, moverColor) {
  // Stockfish's line begins with the opponent's reply to the played move.
  // Look up to four moves ahead for *demonstrated* tactics, never invent a
  // forced sequence from a speculative positional idea.
  const pv = enginePvMoves(afterEvaluation).slice(0, 8);
  if (pv.length < 2) return null;

  try {
    const continuation = new Chess(boardAfter.fen());
    const playedLine = [];
    for (let i = 0; i < pv.length; i++) {
      const follow = getLegalMoveFromUci(continuation, pv[i]);
      if (!follow) break;
      playedLine.push(follow);
      if (follow.color !== moverColor || i < 1) continue;

      const point = findFutureTacticalPoint(continuation, follow);
      if (!point) continue;

      const steps = playedLine.slice(Math.max(0, i - 2))
        .map(describeEngineLineMove).filter(Boolean);
      const currentPiece = boardAfter.get(follow.from);
      const showArrow = currentPiece?.color === moverColor &&
        currentPiece?.type === follow.piece;
      const arrows = showArrow ? [{
        from: follow.from, to: follow.to,
        color: "#6aa0ff", dashed: true,
      }] : [];
      if (showArrow && point.target) {
        arrows.push({
          from: follow.to, to: point.target,
          color: "#f4b84e", dashed: true,
        });
      }
      return {
        text: `One possible engine continuation is: ${steps.join("; then ")}. ${point.text}`,
        arrows,
      };
    }
  } catch (e) {
    return null;
  }
  return null;
}

// Explain bad moves from the position the user is actually looking at. The
// engine's best reply is analyzed *after* the played move; the alternative
// move is checked *before* it. Mixing those two positions can point an arrow
// at the wrong side's piece (and turn the explanation into nonsense).
function enginePvMoves(evaluation) {
  const raw = evaluation?.lines?.[0]?.pv;
  if (Array.isArray(raw)) return raw.filter(move => typeof move === "string");
  if (typeof raw === "string") return raw.trim().split(/\s+/).filter(Boolean);
  return [];
}

function materialWonOnCapture(boardAfterCapture, capture) {
  if (!capture?.captured) return 0;
  // Prefer a legal multi-recapture exchange analysis over the old single
  // 'does anyone defend this square?' shortcut. May be negative: losing a
  // piece in a bad exchange is not a material WIN.
  const verified = window.ChessTactics?.captureGain?.(boardAfterCapture, capture);
  if (Number.isFinite(verified)) return verified;
  try {
    const canRecapture = boardAfterCapture.moves({ verbose: true })
      .some(reply => reply.to === capture.to && Boolean(reply.captured));
    return pieceValue(capture.captured) -
      (canRecapture ? pieceValue(capture.piece) : 0);
  } catch (e) {
    return 0;
  }
}

function missedMaterialCaptureLesson(q, fenBefore, fenAfter) {
  if (!q.engineBest || !fenBefore || !fenAfter) return null;
  try {
    const before = new Chess(fenBefore);
    const best = getLegalMoveFromUci(before, q.engineBest);
    if (!best?.captured || q.engineBest === q.uci) return null;

    // A legal capture is not necessarily a free piece: an even trade is not
    // a "hanging" piece. Check a legal immediate recapture before claiming it.
    const gain = materialWonOnCapture(before, best);
    if (gain < 1) return null;

    const after = new Chess(fenAfter);
    const origin = after.get(best.from);
    const victim = after.get(best.to);
    const canStillShow = origin?.color === best.color &&
      origin?.type === best.piece && victim?.color !== best.color &&
      victim?.type === best.captured;
    const attacker = IDEA_PIECE_NAMES[best.piece] || "piece";
    const captured = IDEA_PIECE_NAMES[best.captured] || "piece";
    return {
      kind: "missed_capture", score: gain,
      text: `You missed a chance to win material: your ${attacker} could have captured the opponent's ${captured} on ${best.to}.`,
      arrows: canStillShow
        ? [{ from: best.from, to: best.to, color: "#f4b84e" }]
        : [],
    };
  } catch (e) {
    return null;
  }
}

function opponentPunishmentLesson(fenAfter, evaluationAfter) {
  if (!fenAfter || !evaluationAfter) return null;
  try {
    const current = new Chess(fenAfter);
    const pv = enginePvMoves(evaluationAfter);
    const firstUci = pv[0] || evaluationAfter.best_move;
    const reply = getLegalMoveFromUci(new Chess(fenAfter), firstUci);
    if (!reply) return null;

    const next = new Chess(fenAfter);
    getLegalMoveFromUci(next, firstUci);
    const opponentPiece = IDEA_PIECE_NAMES[reply.piece] || "piece";
    const redArrow = {
      from: reply.from, to: reply.to, color: "#ff5364",
    };
    const quietArrow = { ...redArrow, dashed: true };
    const captureGain = materialWonOnCapture(next, reply);

    if (/#/.test(reply.san || "")) {
      return {
        kind: "punishment", score: 10,
        text: `This allows your opponent to deliver checkmate with their ${opponentPiece} on ${reply.to}.`,
        arrows: [redArrow],
      };
    }

    if (reply.captured && captureGain >= 1) {
      const target = IDEA_PIECE_NAMES[reply.captured] || "piece";
      return {
        kind: "punishment", score: captureGain + 0.5,
        text: `This allows your opponent to win material by capturing your ${target} on ${reply.to} with their ${opponentPiece}.`,
        arrows: [redArrow],
      };
    }

    const attacker = next.get(reply.to);
    const removable = attacker && canNeutralizeAttackerByCapture(next, reply.to);
    if (attacker && !removable) {
      const pin = findMovePin(next, reply.to, attacker, true);
      if (pin) {
        const pinned = IDEA_PIECE_NAMES[pin.between.piece.type] || "piece";
        const valuable = IDEA_PIECE_NAMES[pin.behind.piece.type] || "piece";
        return {
          kind: "punishment", score: 3,
          text: `This allows your opponent to pin your ${pinned} on ${pin.between.square} to your ${valuable} on ${pin.behind.square} with their ${opponentPiece}.`,
          arrows: [quietArrow, {
            from: reply.to, to: pin.behind.square, color: "#ffb84d", dashed: true,
          }],
        };
      }

      const threatened = squaresControlledBy(next, reply.to, attacker)
        .map(square => ({ square, target: next.get(square) }))
        .filter(({ target }) => target && target.color !== attacker.color &&
          pieceValue(target.type) >= 3);
      const profitable = materiallyUsefulForkTargets(next, attacker, threatened)
        .sort((a, b) => pieceValue(b.target.type) - pieceValue(a.target.type));
      if (profitable.length >= 2 &&
          profitable.some(({ target }) => ["k", "q", "r"].includes(target.type))) {
        const first = profitable[0];
        const second = profitable[1];
        return {
          kind: "punishment", score: 4,
          text: `This lets your opponent create a ${reply.piece === "n" ? "knight fork" : "double attack"}, threatening your ${IDEA_PIECE_NAMES[first.target.type]} on ${first.square} and ${IDEA_PIECE_NAMES[second.target.type]} on ${second.square}.`,
          arrows: [quietArrow, {
            from: reply.to, to: first.square, color: "#ffb84d", dashed: true,
          }],
        };
      }

      const major = profitable.find(({ target }) => ["q", "r"].includes(target.type));
      if (major) {
        return {
          kind: "punishment", score: 2.5,
          text: `This allows your opponent to attack your ${IDEA_PIECE_NAMES[major.target.type]} on ${major.square} with their ${opponentPiece} on ${reply.to}.`,
          arrows: [quietArrow, {
            from: reply.to, to: major.square, color: "#ffb84d", dashed: true,
          }],
        };
      }
    }

    // Some tactics need one preparatory move. Only describe the consequence
    // if the engine PV supplies the actual response and a profitable capture;
    // this is a possible continuation, not a claim of a forced sequence.
    if (pv.length >= 3) {
      const follow = getLegalMoveFromUci(next, pv[1]);
      if (follow) {
        const third = getLegalMoveFromUci(next, pv[2]);
        if (third?.captured && materialWonOnCapture(next, third) >= 1) {
          const victim = IDEA_PIECE_NAMES[third.captured] || "piece";
          const attackerName = IDEA_PIECE_NAMES[third.piece] || "piece";
          const opening = describeVerboseMoveInEnglish(reply);
          const canShowSecond = current.get(third.from)?.color === third.color &&
            current.get(third.from)?.type === third.piece;
          return {
            kind: "punishment", score: pieceValue(third.captured),
            text: `In the engine's continuation, ${opening.toLowerCase()}, and after your response the opponent can capture your ${victim} on ${third.to} with their ${attackerName}.`,
            arrows: [quietArrow, ...(canShowSecond ? [{
              from: third.from, to: third.to, color: "#ff5364", dashed: true,
            }] : [])],
          };
        }
      }
    }

    if (/\+/.test(reply.san || "")) {
      return {
        kind: "punishment", score: 1,
        text: `This lets your opponent give check with their ${opponentPiece} on ${reply.to}, forcing you to respond.`,
        arrows: [quietArrow],
      };
    }
  } catch (e) {
    return null;
  }
  return null;
}

function deriveBadMoveLesson(q, moveIndex, result) {
  const fenBefore = result?.fens?.[moveIndex];
  const fenAfter = result?.fens?.[moveIndex + 1];
  if (!fenBefore || !fenAfter) return null;

  const missed = missedMaterialCaptureLesson(q, fenBefore, fenAfter);
  const punishment = opponentPunishmentLesson(
    fenAfter, result?.evaluations?.[moveIndex + 1]
  );

  // A missed free piece is the clearest lesson for a "miss". Otherwise show
  // the opponent's concrete refutation if it is at least as consequential.
  if (q.severity === "miss" && missed) return missed;
  if (punishment && (!missed || punishment.score >= missed.score)) {
    return punishment;
  }
  return missed || punishment;
}

// Fallback for an absent/uninitialized standalone tactical module. This is
// deliberately conservative: an attack on the king plus an exposed major
// piece qualifies as a checking double attack, but it does NOT prove a forced
// material win without the deeper all-replies check in ChessTactics.
function localCheckingForkEvidence(board, move, piece) {
  if (!/[+#]/.test(move.san || '') || !piece ||
      canNeutralizeAttackerByCapture(board, move.to)) return null;
  const hit = squaresControlledBy(board, move.to, piece)
    .map(square => ({square, target:board.get(square)}))
    .filter(({target}) => target && target.color !== piece.color &&
      ['k', 'q', 'r'].includes(target.type));
  const king = hit.find(({target}) => target.type === 'k');
  const major = hit.find(({target}) => target.type === 'q' || target.type === 'r');
  if (!king || !major) return null;
  return {
    isCheckFork: true,
    forcedMaterialWin: null,
    targets: [
      { ...king, targetValue: pieceValue('k') },
      { ...major, targetValue: pieceValue(major.target.type) },
    ],
  };
}

function deriveMoveIdea(q, moveIndex, result) {
  if (!q?.uci || !result?.fens?.[moveIndex]) return null;

  try {
    const boardBefore = new Chess(result.fens[moveIndex]);
    const before = new Chess(result.fens[moveIndex]);
    const move = getLegalMoveFromUci(before, q.uci);
    if (!move) return null;

    const after = before;
    const piece = after.get(move.to);
    if (!piece) return null;
    // A structured tactical report is generated from the SAME position as
    // the evaluated move. It does not modify quality, EP loss, or game rating.
    const verifiedTactics = q.tactics ||
      window.ChessTactics?.analyzeMove?.(result.fens[moveIndex], q.uci) || null;

    const name = IDEA_PIECE_NAMES[move.piece] || "piece";
    const greenArrow = {
      from: move.from, to: move.to, color: "#7fc957",
    };
    const ideaArrow = to => ({
      from: move.to, to, color: "#f4b84e",
    });
    // Most moves do not need a graphic. Only supply arrows for a real motif.
    const resultIdea = (text, arrows = []) => ({ text, arrows });
    const san = String(move.san || result.moves?.[moveIndex] || "");

    if (san.includes("#")) {
      return resultIdea(
        "Delivers checkmate, leaving no legal escape from the attack.",
        [greenArrow]
      );
    }

    // A checking fork outranks a generic capture explanation. For example,
    // Bxc3+ can simultaneously check the king and attack an unprotected rook;
    // the user needs to understand the fork, not merely 'captures with check'.
    // Never claim the rook is FORCED to fall unless all legal responses prove it.
    const checkingFork = (verifiedTactics?.check &&
      verifiedTactics?.fork?.isCheckFork ? verifiedTactics.fork : null) ||
      localCheckingForkEvidence(after, move, piece);
    const forkedMajor = checkingFork?.targets.find(t =>
      ["q", "r"].includes(t.target.type));
    const forkedKing = checkingFork?.targets.find(t =>
      t.target.type === "k");
    if (forkedMajor && forkedKing) {
      const bigPiece = IDEA_PIECE_NAMES[forkedMajor.target.type] || "piece";
      const introduction = move.captured
        ? `Captures the ${IDEA_PIECE_NAMES[move.captured]} on ${move.to} with check`
        : `Gives check with the ${name}`;
      const forced = checkingFork.forcedMaterialWin;
      const forcedRookOrQueen = forced && forced.target === forkedMajor.square;
      const consequence = forcedRookOrQueen
        ? `The opponent must answer the check, so the ${name} can capture the ${bigPiece} on ${forkedMajor.square} for a material gain.`
        : `The opponent must answer the check while the ${bigPiece} on ${forkedMajor.square} is also under attack.`;
      return resultIdea(
        `${introduction}, attacking the king on ${forkedKing.square} and the ${bigPiece} on ${forkedMajor.square} at the same time. ${consequence}`,
        // Two tactical arrows: king AND rook/queen. The move highlight is
        // already visible on the board; a green travel arrow hid the rook ray.
        [ideaArrow(forkedKing.square), ideaArrow(forkedMajor.square)]
      );
    }

    const discovered = verifiedTactics
      ? verifiedTactics.discovered
      : findDiscoveredAttack(boardBefore, after, move);
    if (discovered) {
      const targetName = IDEA_PIECE_NAMES[discovered.victim.piece.type];
      const attackerName = IDEA_PIECE_NAMES[discovered.attacker.piece.type];
      const isCheck = discovered.victim.piece.type === "k" && san.includes("+");
      return resultIdea(
        `A discovered ${isCheck ? "check" : "attack"}: moving the ${name} opens the ${attackerName}'s line to the opposing ${targetName} on ${discovered.victim.square}.`,
        [
          greenArrow,
          { from: discovered.attacker.square, to: discovered.victim.square, color: "#f4b84e" },
        ]
      );
    }

    if (/^O-O/.test(san)) {
      return resultIdea("Castles to improve king safety and bring the rook into play.");
    }

    const attackerCanBeTaken = verifiedTactics
      ? verifiedTactics.attackerCanBeTaken
      : canNeutralizeAttackerByCapture(after, move.to);
    const pin = !attackerCanBeTaken &&
      (verifiedTactics ? verifiedTactics.pin :
        findMovePin(after, move.to, piece, true));
    const skewer = !attackerCanBeTaken &&
      findMoveSkewer(after, move.to, piece);

    // A capture can do more than remove material. Explain its *additional*
    // purpose (new protection, pin, check) before falling back to a plain
    // material explanation. This handles Qxh5 guarding the knight on f3.
    if (move.captured) {
      const capturedName = IDEA_PIECE_NAMES[move.captured] || "piece";
      const guarded = newlyProtectedAlly(boardBefore, after, move);
      if (guarded) {
        const allyName = IDEA_PIECE_NAMES[guarded.ally.type] || "piece";
        const guardedText = guarded.underAttack
          ? `protects the ${allyName} on ${guarded.square} from an existing attack`
          : `adds protection to the ${allyName} on ${guarded.square}`;
        return resultIdea(
          `Captures the opposing ${capturedName} on ${move.to} and ${guardedText}.`,
          [greenArrow, ideaArrow(guarded.square)]
        );
      }
      if (pin) {
        return resultIdea(
          `Captures the ${capturedName} on ${move.to} and pins the ${IDEA_PIECE_NAMES[pin.between.piece.type]} on ${pin.between.square} to the ${IDEA_PIECE_NAMES[pin.behind.piece.type]} on ${pin.behind.square}.`,
          [greenArrow, ideaArrow(pin.behind.square)]
        );
      }
      if (skewer) {
        return resultIdea(
          `Captures the ${capturedName} on ${move.to} and creates a skewer against the ${IDEA_PIECE_NAMES[skewer.front.piece.type]} on ${skewer.front.square}.`,
          [greenArrow, ideaArrow(skewer.behind.square)]
        );
      }
      if (san.includes("+")) {
        return resultIdea(
          `Captures the ${capturedName} on ${move.to} with check, forcing the opponent to respond.`,
          [greenArrow]
        );
      }
      const materialGain = verifiedTactics?.capture?.netExchangeGain ??
        materialWonOnCapture(after, move);
      return resultIdea(
        materialGain >= 1
          ? `Wins the opposing ${capturedName} on ${move.to}, gaining material.`
          : `Captures the opposing ${capturedName} on ${move.to}, completing a sound exchange.`,
        pieceValue(move.captured) >= 3 ? [greenArrow] : []
      );
    }

    if (pin) {
      const pinned = IDEA_PIECE_NAMES[pin.between.piece.type] || "piece";
      const valuable = IDEA_PIECE_NAMES[pin.behind.piece.type] || "piece";
      return resultIdea(
        `Pins the ${pinned} on ${pin.between.square} to the ${valuable} on ${pin.behind.square}, increasing the pressure.`,
        [ideaArrow(pin.behind.square)]
      );
    }

    if (skewer) {
      const front = IDEA_PIECE_NAMES[skewer.front.piece.type];
      const behind = IDEA_PIECE_NAMES[skewer.behind.piece.type];
      return resultIdea(
        `Creates a skewer: the ${front} on ${skewer.front.square} is attacked first, with the ${behind} on ${skewer.behind.square} behind it.`,
        [ideaArrow(skewer.behind.square)]
      );
    }

    const attackedTargets = squaresControlledBy(after, move.to, piece)
      .map(square => ({ square, target: after.get(square) }))
      .filter(({ target }) => target && target.color !== piece.color &&
        pieceValue(target.type) >= 3)
      .sort((a, b) => pieceValue(b.target.type) - pieceValue(a.target.type));

    const profitableTargets = verifiedTactics
      ? (verifiedTactics.fork?.targets || [])
      : materiallyUsefulForkTargets(after, piece, attackedTargets);
    if (!attackerCanBeTaken && profitableTargets.length >= 2 &&
        profitableTargets.some(({ target }) => ["k", "q", "r"].includes(target.type)) &&
        ["n", "p", "b", "r", "q"].includes(move.piece)) {
      const pair = profitableTargets.slice(0, 2);
      const targets = pair.map(({ square, target }) =>
        `${IDEA_PIECE_NAMES[target.type]} on ${square}`);
      // A check is forcing, but winning the second piece is only guaranteed
      // if ALL legal check responses preserve a profitable capture.
      const forced = verifiedTactics?.fork?.forcedMaterialWin;
      const forcedText = forced
        ? `This ${move.piece === "n" ? "knight fork" : "double attack"} checks the king and forces a material win on ${forced.target}.`
        : `Creates a ${move.piece === "n" ? "knight fork" : "double attack"}, attacking the ${targets.join(" and the ")} at the same time.`;
      return resultIdea(forcedText, pair.map(({ square }) => ideaArrow(square)));
    }

    // Prefer attacks that arose from THIS move, not a long-standing ray that
    // happened to remain open. A target can defend or move: do not call it won.
    const threatened = verifiedTactics
      ? verifiedTactics.threats.filter(t => t.fresh)
          .sort((a,b) => pieceValue(b.target.type)-pieceValue(a.target.type))[0]
      : attackedTargets[0];
    if (!attackerCanBeTaken && threatened &&
        pieceValue(threatened.target.type) >= 5) {
      const targetName = IDEA_PIECE_NAMES[threatened.target.type];
      return resultIdea(
        `The ${name} attacks the opposing ${targetName} on ${threatened.square}, creating a concrete threat.`,
        [ideaArrow(threatened.square)]
      );
    }

    if (san.includes("+")) {
      return resultIdea(
        "Gives check, forcing a response to the attack on the king.",
        [greenArrow]
      );
    }

    if (move.promotion) {
      return resultIdea(
        `Promotes the pawn to a ${IDEA_PIECE_NAMES[move.promotion] || "new piece"}, greatly increasing its power.`,
        [greenArrow]
      );
    }

    if (q.type === "brilliant" && q.brilliantReason) {
      return resultIdea(
        `This ${q.brilliantReason} is supported by the engine's evaluation, despite the apparent risk.`,
        [greenArrow]
      );
    }

    const startRank = piece.color === "w" ? "1" : "8";

    // A supporting pawn can defend two allies. Example: e3 supporting
    // the d4 pawn and f4 bishop, with one arrow to each square.
    if (move.piece === "p") {
      const defended = squaresControlledBy(after, move.to, piece)
        .map(square => ({ square, ally: after.get(square) }))
        .filter(({ ally }) => ally && ally.color === piece.color &&
          ally.type !== "k")
        .slice(0, 2);
      if (defended.length) {
        const supported = defended.map(({ square, ally }) =>
          `${IDEA_PIECE_NAMES[ally.type]} on ${square}`);
        return resultIdea(
          `The pawn on ${move.to} reinforces the ${supported.join(" and the ")}.`,
          defended.map(({ square }) => ideaArrow(square))
        );
      }

      // A pawn on d6, for instance, can support a potential ...e5 break.
      const centralBreak = findSupportedCentralPush(after, move.to, piece);
      if (centralBreak) return centralBreak;
    }

    if (move.piece === "n" || move.piece === "b") {
      if (move.from[1] === startRank) {
        const development = describeControlledCenter(
          after, move.to, piece, name, true
        );
        if (development) return development;
        if (move.piece === "b" &&
            ["b2", "g2", "b7", "g7"].includes(move.to)) {
          return resultIdea(
            "Fianchetto development puts the bishop on a long diagonal; its influence grows as the line opens."
          );
        }
        return resultIdea(
          `Develops the ${name}, improving its activity and coordination.`
        );
      }
    }

    if (move.piece === "p" && IDEA_CENTER.includes(move.to)) {
      return resultIdea(
        `Claims central space on ${move.to} and gives the other pieces room to develop.`
      );
    }

    if (move.piece === "r") {
      // A rook lined up with an immobile pawn can create pressure without
      // actually pinning it. Describe the visible threat in plain language.
      const pressuredPawn = squaresControlledBy(after, move.to, piece)
        .find(square => {
          const occupant = after.get(square);
          return occupant?.color !== piece.color && occupant?.type === "p";
        });
      if (pressuredPawn && !attackerCanBeTaken) {
        return resultIdea(
          `Places the rook on ${move.to}, putting pressure on the opposing pawn on ${pressuredPawn}.`
        );
      }

      const file = move.to[0];
      const sameFile = [];
      for (let rank = 1; rank <= 8; rank++) {
        const occupant = after.get(`${file}${rank}`);
        if (occupant?.type === "p") sameFile.push(occupant);
      }
      if (!sameFile.some(pawn => pawn.color === piece.color)) {
        const open = sameFile.length === 0;
        return resultIdea(
          `Places the rook on the ${open ? "open" : "semi-open"} ${file}-file, where it can pressure the opponent's position.`
        );
      }
    }

    if (move.piece === "n" || move.piece === "b") {
      const centerIdea = describeControlledCenter(
        after, move.to, piece, name
      );
      if (centerIdea) return centerIdea;
    }

    const engineLine = getEngineFollowUp(
      after, result.evaluations?.[moveIndex + 1], piece.color
    );
    if (engineLine) return engineLine;

    const fallback = q.type === "book"
      ? "Follows a known opening plan and keeps the development on track."
      : "A solid move that maintains the position.";
    return resultIdea(fallback);
  } catch (e) {
    return null;
  }
}

function opponentCanCaptureSquare(boardAfterMove, square) {
  try {
    return boardAfterMove.moves({ verbose: true }).some(move => {
      return move.to === square && Boolean(move.captured);
    });
  } catch (e) {
    return false;
  }
}

function getOpponentCapturesOfValuablePieces(boardAfterMove) {
  const threats = [];

  try {
    const replies = boardAfterMove.moves({ verbose: true });

    for (const reply of replies) {
      if (!reply.captured) continue;

      const capturedValue = pieceValue(reply.captured);

      if (capturedValue >= 5) {
        threats.push({
          square: reply.to,
          capturedPiece: reply.captured,
          capturedValue,
          attackerFrom: reply.from,
          attackerPiece: reply.piece,
        });
      }
    }
  } catch (e) {
    return [];
  }

  return threats;
}

function pvMaterialGainForPlayer(boardAfterMove, pv, playerMultiplier, maxPlies = 6) {
  if (!Array.isArray(pv) || pv.length === 0) return 0;

  try {
    const board = new Chess(boardAfterMove.fen());
    const materialStart = getMaterialBalance(board);

    for (const uci of pv.slice(0, maxPlies)) {
      const moveObj = moveObjectFromUci(uci);
      if (!moveObj) break;

      const played = board.move(moveObj);
      if (!played) break;
    }

    const materialEnd = getMaterialBalance(board);

    return (materialEnd - materialStart) * playerMultiplier;
  } catch (e) {
    return 0;
  }
}

function getEpErrorThresholds(playerRating, beforeEP) {
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  const rating = clamp(Number(playerRating) || 1000, 300, 3000);
  const skill = (rating - 300) / 2700;

  // Lower-rated players get a tiny bit more forgiveness,
  // but not enough to completely change the category.
  const ratingFactor = 1.08 - skill * 0.16;

  // EP swings are less meaningful when the game is already almost decided.
  const extremePositionFactor =
    beforeEP >= 0.88 || beforeEP <= 0.12
      ? 1.16
      : beforeEP >= 0.80 || beforeEP <= 0.20
        ? 1.08
        : 1.0;

  return {
    inaccuracy: 0.055 * ratingFactor * extremePositionFactor,
    mistake: 0.125 * ratingFactor * extremePositionFactor,
    blunder: 0.245 * ratingFactor * extremePositionFactor,
  };
}

const BAD_MOVE_TYPES = new Set(["inaccuracy", "mistake", "miss", "blunder"]);

function getSanAt(moves, index) {
  const move = moves?.[index];

  if (!move) return "";

  if (typeof move === "string") return move;

  return (
    move.san ||
    move.move ||
    move.notation ||
    move.lan ||
    ""
  );
}

function cleanSan(san) {
  return String(san || "")
    .replace(/[!?]+/g, "")
    .trim();
}

function isCaptureSan(san) {
  return cleanSan(san).includes("x");
}

function isCheckSan(san) {
  return /[+#]/.test(cleanSan(san));
}

function isMateSan(san) {
  return /#/.test(cleanSan(san));
}

function isCastleSan(san) {
  return /^O-O/.test(cleanSan(san));
}

function isKingMoveSan(san) {
  return /^K/.test(cleanSan(san));
}

function isPromotionSan(san) {
  return /=/.test(cleanSan(san));
}

function isLikelyRoutineRecapture(moves, index) {
  const san = getSanAt(moves, index);
  const prevSan = getSanAt(moves, index - 1);

  if (!isCaptureSan(san)) return false;
  if (!isCaptureSan(prevSan)) return false;

  return true;
}

function isBookishMove(q) {
  return q?.type === "book" || q?.isBook === true;
}

function isBadMove(q) {
  return BAD_MOVE_TYPES.has(q?.type);
}

function getCp(q, key) {
  const value = Number(q?.[key]);
  return Number.isFinite(value) ? value : 0;
}

function getEvalLoss(q) {
  const value = Number(q?.evalLoss);
  return Number.isFinite(value) ? Math.abs(value) : 0;
}

function getEpLoss(q) {
  const value = Number(q?.epLoss);
  return Number.isFinite(value) ? Math.abs(value) : 0;
}

function getTopMoveGap(q) {
  const value = Number(q?.topMoveGap);
  return Number.isFinite(value) ? Math.abs(value) : 0;
}

function isActualSacrifice(q) {
  const reason = String(q?.brilliantReason || "").toLowerCase();

  return (
    q?.sacrificesMaterial === true ||
    q?.sacrificeMaterial === true ||
    q?.isSacrifice === true ||
    reason.includes("sacrifice") ||
    reason.includes("hanging-piece")
  );
}

function isQuietThreatIgnore(q, san) {
  const reason = String(q?.brilliantReason || "").toLowerCase();

  if (!reason.includes("ignored")) return false;
  if (!reason.includes("threat")) return false;

  // Quiet brilliants should not just be normal captures/checks.
  if (isCaptureSan(san)) return false;
  if (isCheckSan(san)) return false;

  return true;
}

function isSimpleSpecialMoveSan(san) {
  return (
    isKingMoveSan(san) ||
    isCastleSan(san) ||
    isPromotionSan(san) ||
    isMateSan(san)
  );
}

function fallbackStrongMoveType(q) {
  const evalLoss = getEvalLoss(q);
  const epLoss = getEpLoss(q);

  if (evalLoss <= 15 && epLoss <= 0.015) return "best";
  if (evalLoss <= 45 && epLoss <= 0.045) return "excellent";
  if (evalLoss <= 80 && epLoss <= 0.070) return "good";

  return q?.type || "good";
}

function shouldAllowBrilliantPromotion(q, moves, index) {
  const san = getSanAt(moves, index);

  if (!q) return false;
  if (isBookishMove(q)) return false;
  if (isBadMove(q)) return false;
  if (isSimpleSpecialMoveSan(san)) return false;
  if (isLikelyRoutineRecapture(moves, index)) return false;

  const evalLoss = getEvalLoss(q);
  const epLoss = getEpLoss(q);
  const topMoveGap = getTopMoveGap(q);
  const beforeCp = getCp(q, "beforeCpPlayer");
  const afterCp = getCp(q, "afterCpPlayer");

  const nearPerfect =
    evalLoss <= 25 &&
    epLoss <= 0.035;

  if (!nearPerfect) return false;

  const actualSacrifice = isActualSacrifice(q);
  const quietThreatIgnore = isQuietThreatIgnore(q, san);

  // Real sacrifices can be brilliant even when already better.
  if (actualSacrifice) {
    if (topMoveGap < 35) return false;

    // Do not call totally obvious recaptures/captures brilliant.
    if (isLikelyRoutineRecapture(moves, index)) return false;

    return true;
  }

  // Non-sacrifice brilliants should be much rarer.
  // This is for moves like d3 / Nf5 where a player ignores a threat
  // because there is a stronger tactical resource.
  if (quietThreatIgnore) {
    const positionIsStillCompetitive =
      beforeCp > -350 &&
      beforeCp < 450;

    const moveDoesNotHurt =
      afterCp >= beforeCp - 25;

    const moveHasTacticalSeparation =
      topMoveGap >= 25;

    if (!positionIsStillCompetitive) return false;
    if (!moveDoesNotHurt) return false;
    if (!moveHasTacticalSeparation) return false;

    return true;
  }

  return false;
}

function shouldAllowGreatPromotion(q, moves, index) {
  const san = getSanAt(moves, index);

  if (!q) return false;
  if (isBookishMove(q)) return false;
  if (isBadMove(q)) return false;
  if (q.type === "brilliant") return false;
  if (isSimpleSpecialMoveSan(san)) return false;

  const evalLoss = getEvalLoss(q);
  const epLoss = getEpLoss(q);
  const topMoveGap = getTopMoveGap(q);
  const beforeCp = getCp(q, "beforeCpPlayer");
  const afterCp = getCp(q, "afterCpPlayer");
  const improvement = afterCp - beforeCp;

  const isNearBest =
    evalLoss <= 35 &&
    epLoss <= 0.035;

  const isOnlyMoveClean =
    evalLoss <= 70 &&
    epLoss <= 0.045;

  if (!isNearBest && !isOnlyMoveClean) return false;

  const routineRecapture = isLikelyRoutineRecapture(moves, index);
  if (routineRecapture) return false;

  const actualSacrifice = isActualSacrifice(q);

  const alreadyCompletelyWinning =
    beforeCp > 550 &&
    afterCp > 550;

  // Great moves should usually happen while the position still has tension.
  // Do not mark normal conversion moves as Great just because Stockfish likes them.
  if (alreadyCompletelyWinning && !actualSacrifice && q?.likelyGreatMove !== true) {
    return false;
  }

  const savesBadPosition =
    beforeCp < -100 &&
    improvement >= 150 &&
    afterCp > -700;

  const findsBigOnlyMove =
    topMoveGap >= 240 &&
    beforeCp > -550 &&
    beforeCp < 550 &&
    afterCp >= -200;

  const improvesClearly =
    improvement >= 180 &&
    beforeCp < 400 &&
    afterCp > -150;

  const explicitLikelyGreat =
    q?.likelyGreatMove === true &&
    (topMoveGap >= 180 || improvement >= 150 || savesBadPosition);

  // Captures and checks are common. They need extra separation/context.
  if (isCaptureSan(san)) {
    return (
      actualSacrifice ||
      savesBadPosition ||
      topMoveGap >= 260 ||
      improvesClearly ||
      explicitLikelyGreat
    );
  }

  if (isCheckSan(san)) {
    return (
      actualSacrifice ||
      savesBadPosition ||
      topMoveGap >= 260 ||
      improvesClearly ||
      explicitLikelyGreat
    );
  }

  return (
    savesBadPosition ||
    findsBigOnlyMove ||
    improvesClearly ||
    explicitLikelyGreat
  );
}

function applyStrictSpecialMovePromotions(qualities, moves) {
  if (!Array.isArray(qualities)) return qualities;

  for (let i = 0; i < qualities.length; i++) {
    const q = qualities[i];
    if (!q) continue;

    // If the old loose system already promoted something, demote it first
    // unless it passes the stricter rules below.
    if (q.type === "brilliant" && !shouldAllowBrilliantPromotion(q, moves, i)) {
      q.type = fallbackStrongMoveType(q);
      q.brilliantReason = null;
    }

    if (q.type === "great" && !shouldAllowGreatPromotion(q, moves, i)) {
      q.type = fallbackStrongMoveType(q);
      q.likelyGreatMove = false;
    }
  }

  for (let i = 0; i < qualities.length; i++) {
    const q = qualities[i];
    if (!q) continue;

    if (shouldAllowBrilliantPromotion(q, moves, i)) {
      q.type = "brilliant";
      continue;
    }

    if (shouldAllowGreatPromotion(q, moves, i)) {
      q.type = "great";
    }
  }

  return qualities;
}

function greatMoveScore(q) {
  if (!q) return 0;

  const evalLoss = getEvalLoss(q);
  const epLoss = getEpLoss(q);
  const topMoveGap = getTopMoveGap(q);
  const beforeCp = getCp(q, "beforeCpPlayer");
  const afterCp = getCp(q, "afterCpPlayer");
  const improvement = afterCp - beforeCp;

  let score = 0;

  score += topMoveGap;
  score += Math.max(0, improvement) * 0.65;

  if (q.likelyGreatMove === true) score += 110;
  if (q.savedPosition === true) score += 140;
  if (isActualSacrifice(q)) score += 120;
  if (q.givesCheck) score += 25;
  if (q.isCapture) score += 15;

  if (evalLoss > 70 || epLoss > 0.055) score -= 140;
  if (beforeCp > 550 && afterCp > 550 && !q.savedPosition && !isActualSacrifice(q)) score -= 180;
  if (Math.abs(afterCp) >= 9000 && topMoveGap < 120 && q.likelyGreatMove !== true) score -= 220;

  return score;
}


function bestDisplayScore(q) {
  if (!q) return 0;

  const evalLoss = getEvalLoss(q);
  const epLoss = getEpLoss(q);
  const topMoveGap = getTopMoveGap(q);
  const beforeCp = getCp(q, "beforeCpPlayer");
  const afterCp = getCp(q, "afterCpPlayer");
  const improvement = afterCp - beforeCp;
  const context = q.positionContext || {};

  let score = 0;

  score += topMoveGap;
  score += Math.max(0, improvement) * 0.35;

  if (context.competitive) score += 35;
  if (q.likelyGreatMove) score += 80;
  if (q.givesCheck) score += 22;
  if (q.isCapture) score += 16;
  if (q.forced) score += 200;

  // A top engine move in a totally winning cleanup position is often just
  // Excellent on Chess.com, not automatically Best.
  if (context.winning && context.keepsWin && !q.givesCheck && !q.isCapture) {
    score -= 45;
  }

  if (evalLoss > 40 || epLoss > 0.025) score -= 55;

  return score;
}

function normalizeRoutineBestMoveCounts(qualities) {
  if (!Array.isArray(qualities)) return qualities;

  const bySide = { white: [], black: [] };
  const moveCountsBySide = { white: 0, black: 0 };

  for (let i = 0; i < qualities.length; i++) {
    const q = qualities[i];
    if (!q || q.type === "book") continue;

    const side = i % 2 === 0 ? "white" : "black";
    moveCountsBySide[side] += 1;

    if (q.type === "best" && !q.forced) {
      bySide[side].push({ index: i, q, score: bestDisplayScore(q) });
    }
  }

  const demoteBest = (q) => {
    q.type = "excellent";
    q.severity = null;
  };

  for (const side of ["white", "black"]) {
    const candidates = bySide[side];
    if (!candidates.length) continue;

    candidates.forEach((item) => {
      const q = item.q;
      const context = q.positionContext || {};
      const ratingBand = context.ratingBand || "mid";
      const topMoveGap = getTopMoveGap(q);
      const evalLoss = getEvalLoss(q);
      const epLoss = getEpLoss(q);

      const quietTopMove =
        !q.givesCheck &&
        !q.isCapture &&
        !q.likelyGreatMove;

      const routineWinningCleanup =
        context.winning &&
        context.keepsWin &&
        quietTopMove &&
        topMoveGap < 120 &&
        evalLoss <= 70 &&
        epLoss <= 0.035;

      const lowRatedRoutineTop =
        ratingBand === "low" &&
        quietTopMove &&
        topMoveGap < 95 &&
        evalLoss <= 55 &&
        epLoss <= 0.030;

      const midRatedRoutineCleanup =
        ratingBand === "mid" &&
        routineWinningCleanup &&
        topMoveGap < 65;

      const highRatedDeadCleanup =
        ratingBand === "high" &&
        routineWinningCleanup &&
        !context.competitive &&
        topMoveGap < 35;

      if (lowRatedRoutineTop || midRatedRoutineCleanup || highRatedDeadCleanup) {
        demoteBest(q);
      }
    });

    const stillBest = candidates
      .filter((item) => item.q.type === "best")
      .sort((a, b) => b.score - a.score);

    // Low-rated games were getting flooded with Best moves because every quiet
    // Stockfish top move was counted. Cap only the low/mid bands; high-rated
    // games are allowed to have more true Best moves.
    const sampleBand =
      stillBest[0]?.q?.positionContext?.ratingBand ||
      candidates[0]?.q?.positionContext?.ratingBand ||
      "mid";

    let maxBest = Infinity;
    if (sampleBand === "low") {
      maxBest = moveCountsBySide[side] >= 45 ? 12 : 9;
    } else if (sampleBand === "mid") {
      maxBest = moveCountsBySide[side] >= 45 ? 14 : 10;
    }

    stillBest.forEach((item, rank) => {
      if (rank >= maxBest) demoteBest(item.q);
    });
  }

  return qualities;
}

function normalizeGreatMoveCounts(qualities) {
  if (!Array.isArray(qualities)) return qualities;

  const candidatesBySide = { white: [], black: [] };
  const moveCountsBySide = { white: 0, black: 0 };

  for (let i = 0; i < qualities.length; i++) {
    const q = qualities[i];
    if (!q || q.type === "book") continue;

    const side = i % 2 === 0 ? "white" : "black";
    moveCountsBySide[side] += 1;

    if (q.type === "great") {
      candidatesBySide[side].push({ index: i, q, score: greatMoveScore(q) });
    }
  }

  for (const side of ["white", "black"]) {
    const candidates = candidatesBySide[side];
    if (!candidates.length) continue;

    // Chess.com-style Great moves are highlights, not every clean tactic.
    // Keep only strong candidates, then cap the count per side.
    const minScore = 150;
    const maxGreats = moveCountsBySide[side] >= 45 ? 5 : 4;

    candidates.sort((a, b) => b.score - a.score);

    candidates.forEach((item, rank) => {
      if (item.score < minScore || rank >= maxGreats) {
        const q = item.q;
        const evalLoss = getEvalLoss(q);
        const epLoss = getEpLoss(q);

        if (evalLoss <= 25 && epLoss <= 0.025) {
          q.type = "best";
        } else if (evalLoss <= 70 && epLoss <= 0.055) {
          q.type = "excellent";
        } else {
          q.type = "good";
        }

        q.severity = null;
        q.likelyGreatMove = false;
      }
    });
  }

  return qualities;
}


function normalizeExcellentAndSoftErrorBalance(qualities) {
  if (!Array.isArray(qualities)) return qualities;

  const bySide = { white: [], black: [] };

  for (let i = 0; i < qualities.length; i++) {
    const q = qualities[i];
    if (!q || q.type === "book") continue;

    const side = i % 2 === 0 ? "white" : "black";
    bySide[side].push({ index: i, q });
  }

  const setType = (q, type) => {
    q.type = type;
    q.severity = BAD_MOVE_TYPES.has(type) ? type : null;
  };

  const isTopOrNear = (q) => {
    const idx = Number(q.playedTopLineIndex);
    return Number.isFinite(idx) && idx >= 0 && idx <= 2;
  };

  const isWinningConversion = (q) => {
    const beforeCp = getCp(q, "beforeCpPlayer");
    const afterCp = getCp(q, "afterCpPlayer");
    const epLoss = getEpLoss(q);
    const evalLoss = getEvalLoss(q);

    return (
      beforeCp >= 450 &&
      afterCp >= 300 &&
      epLoss <= 0.080 &&
      evalLoss <= 210
    );
  };

  // First undo the biggest overcorrection: safe winning conversions should not
  // become random Inaccuracies/Mistakes unless they actually throw the win away.
  for (const side of ["white", "black"]) {
    for (const { q } of bySide[side]) {
      if (!q || q.type === "book") continue;
      if (!["inaccuracy", "mistake"].includes(q.type)) continue;

      const epLoss = getEpLoss(q);
      const evalLoss = getEvalLoss(q);
      const beforeCp = getCp(q, "beforeCpPlayer");
      const afterCp = getCp(q, "afterCpPlayer");
      const context = q.positionContext || {};

      const keepsLargeWin =
        isWinningConversion(q) &&
        context.keepsWin !== false &&
        afterCp >= beforeCp - 210;

      if (keepsLargeWin) {
        if (beforeCp >= 750 && afterCp >= 550 && epLoss <= 0.050 && evalLoss <= 140) {
          setType(q, "excellent");
        } else {
          setType(q, "good");
        }
      }
    }
  }

  // Then stop Excellent from swallowing the whole game. Chess.com uses Excellent
  // for clean moves, but it still downgrades the weaker clean moves to Good or
  // Inaccuracy, especially when the player has many other errors in the game.
  for (const side of ["white", "black"]) {
    const moves = bySide[side];
    if (!moves.length) continue;

    const sampleBand =
      moves.find(({ q }) => q?.positionContext?.ratingBand)?.q?.positionContext?.ratingBand ||
      "mid";

    const badCount = moves.filter(({ q }) => BAD_MOVE_TYPES.has(q?.type)).length;
    const excellent = moves.filter(({ q }) => q?.type === "excellent");

    let maxExcellentRatio;
    if (sampleBand === "high") {
      maxExcellentRatio = badCount >= 6 ? 0.38 : 0.44;
    } else if (sampleBand === "mid") {
      maxExcellentRatio = badCount >= 7 ? 0.40 : 0.48;
    } else {
      maxExcellentRatio = badCount >= 8 ? 0.36 : 0.49;
    }

    // Short games should not be forced into a tiny number of Excellents.
    const minExcellent = moves.length >= 45 ? 8 : 4;
    const maxExcellent = Math.max(minExcellent, Math.ceil(moves.length * maxExcellentRatio));
    const excess = excellent.length - maxExcellent;

    if (excess <= 0) continue;

    excellent
      .map(({ index, q }) => {
        const epLoss = getEpLoss(q);
        const evalLoss = getEvalLoss(q);
        const topMoveGap = getTopMoveGap(q);
        const beforeCp = getCp(q, "beforeCpPlayer");
        const afterCp = getCp(q, "afterCpPlayer");
        const context = q.positionContext || {};

        let score = 0;
        score += epLoss * 1000;
        score += evalLoss * 0.45;
        score += Math.max(0, beforeCp - afterCp) * 0.05;
        if (!isTopOrNear(q)) score += 18;
        if (context.competitive) score += 10;
        if (context.winning && !context.keepsWin) score += 16;
        if (q.isCapture) score -= 8;
        if (q.givesCheck) score -= 6;
        if (q.likelyGreatMove) score -= 20;

        return { index, q, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, excess)
      .forEach(({ q }) => {
        const epLoss = getEpLoss(q);
        const evalLoss = getEvalLoss(q);
        const context = q.positionContext || {};
        const highRated = context.ratingBand === "high";
        const competitive = context.competitive === true;

        if (
          highRated &&
          competitive &&
          (epLoss >= 0.090 || evalLoss >= 170)
        ) {
          setType(q, "mistake");
        } else if (
          (highRated && competitive && (epLoss >= 0.052 || evalLoss >= 115)) ||
          (epLoss >= 0.045 && evalLoss >= 60) ||
          epLoss >= 0.060 ||
          evalLoss >= 135
        ) {
          setType(q, "inaccuracy");
        } else {
          setType(q, "good");
        }
      });
  }

  // Finally tighten high-rated competitive middlegames. At that level, a real
  // 0.06-0.12 expected-point drop should rarely stay Good/Excellent.
  for (const side of ["white", "black"]) {
    for (const { q } of bySide[side]) {
      if (!q || q.type === "book") continue;

      const context = q.positionContext || {};
      if (context.ratingBand !== "high" || context.competitive !== true) continue;
      if (isWinningConversion(q)) continue;

      const epLoss = getEpLoss(q);
      const evalLoss = getEvalLoss(q);
      const beforeCp = getCp(q, "beforeCpPlayer");
      const afterCp = getCp(q, "afterCpPlayer");
      const drop = beforeCp - afterCp;

      if (["best", "great", "brilliant"].includes(q.type)) continue;

      if (
        ["excellent", "good", "inaccuracy"].includes(q.type) &&
        (epLoss >= 0.105 || evalLoss >= 190 || drop >= 260)
      ) {
        setType(q, "mistake");
      } else if (
        ["excellent", "good"].includes(q.type) &&
        (epLoss >= 0.055 || evalLoss >= 115 || drop >= 170)
      ) {
        setType(q, "inaccuracy");
      }
    }
  }

  return qualities;
}


function normalizeMiddleBucketSeverity(qualities) {
  if (!Array.isArray(qualities)) return qualities;

  const bySide = { white: [], black: [] };

  const setType = (q, type) => {
    q.type = type;
    q.severity = BAD_MOVE_TYPES.has(type) ? type : null;
  };

  const isMateLikeMove = (q) => {
    const beforeCp = Math.abs(getCp(q, "beforeCpPlayer"));
    const afterCp = Math.abs(getCp(q, "afterCpPlayer"));
    return beforeCp >= 9000 || afterCp >= 9000;
  };

  const isSafeConversion = (q) => {
    const beforeCp = getCp(q, "beforeCpPlayer");
    const afterCp = getCp(q, "afterCpPlayer");
    const epLoss = getEpLoss(q);
    const evalLoss = getEvalLoss(q);
    const context = q.positionContext || {};

    return (
      !isMateLikeMove(q) &&
      (context.winning || beforeCp >= 450) &&
      afterCp >= 250 &&
      epLoss <= 0.090 &&
      evalLoss <= 230
    );
  };

  const isActuallyCostly = (q) => {
    const epLoss = getEpLoss(q);
    const evalLoss = getEvalLoss(q);
    const topMoveGap = getTopMoveGap(q);
    const beforeCp = getCp(q, "beforeCpPlayer");
    const afterCp = getCp(q, "afterCpPlayer");
    const drop = beforeCp - afterCp;

    return (
      epLoss >= 0.040 ||
      evalLoss >= 80 ||
      topMoveGap >= 45 ||
      drop >= 120
    );
  };

  for (let i = 0; i < qualities.length; i++) {
    const q = qualities[i];
    if (!q || q.type === "book") continue;

    const side = i % 2 === 0 ? "white" : "black";
    bySide[side].push({ index: i, q });
  }

  for (const side of ["white", "black"]) {
    const moves = bySide[side];
    if (!moves.length) continue;

    const sampleBand =
      moves.find(({ q }) => q?.positionContext?.ratingBand)?.q?.positionContext?.ratingBand ||
      "mid";

    // 1) If a side already has real errors, do not invent more. But when a side
    // has zero soft errors and many "Good" moves with real measurable loss,
    // Chess.com normally still labels a couple as inaccuracies/mistakes.
    const softErrorTypes = new Set(["inaccuracy", "mistake"]);
    let softErrorCount = moves.filter(({ q }) => softErrorTypes.has(q?.type)).length;

    const nonTerminalBadCount = moves.filter(({ q }) =>
      ["inaccuracy", "mistake", "miss", "blunder"].includes(q?.type)
    ).length;

    const targetSoftFloor =
      moves.length >= 45
        ? (sampleBand === "low" ? 3 : sampleBand === "mid" ? 2 : 1)
        : (sampleBand === "low" ? 2 : 1);

    if (softErrorCount < targetSoftFloor && nonTerminalBadCount <= 6) {
      const candidates = moves
        .filter(({ q }) =>
          q?.type === "good" &&
          !isSafeConversion(q) &&
          !isMateLikeMove(q) &&
          isActuallyCostly(q)
        )
        .map(({ index, q }) => {
          const epLoss = getEpLoss(q);
          const evalLoss = getEvalLoss(q);
          const topMoveGap = getTopMoveGap(q);
          const beforeCp = getCp(q, "beforeCpPlayer");
          const afterCp = getCp(q, "afterCpPlayer");
          const drop = beforeCp - afterCp;
          const context = q.positionContext || {};

          let score = epLoss * 1000 + evalLoss * 0.35 + topMoveGap * 0.12 + Math.max(0, drop) * 0.04;
          if (context.competitive) score += 12;
          if (sampleBand === "high") score += 8;
          if (q.isCapture) score -= 5;
          if (q.givesCheck) score -= 5;

          return { index, q, score };
        })
        .sort((a, b) => b.score - a.score);

      for (const item of candidates) {
        if (softErrorCount >= targetSoftFloor) break;

        const q = item.q;
        const epLoss = getEpLoss(q);
        const evalLoss = getEvalLoss(q);
        const context = q.positionContext || {};

        if (
          context.competitive &&
          (epLoss >= 0.075 || evalLoss >= 155)
        ) {
          setType(q, "mistake");
        } else {
          setType(q, "inaccuracy");
        }

        softErrorCount += 1;
      }
    }

    // 2) Winning-side forgiveness, but only for non-catastrophic errors.
    // This fixes cases where a player is already winning, keeps a clear edge,
    // but a +6 -> +3 type conversion gets marked as a full mistake.
    for (const { q } of moves) {
      if (!q || q.type === "book") continue;
      if (!["mistake", "inaccuracy"].includes(q.type)) continue;
      if (!isSafeConversion(q)) continue;

      const epLoss = getEpLoss(q);
      const evalLoss = getEvalLoss(q);
      const beforeCp = getCp(q, "beforeCpPlayer");
      const afterCp = getCp(q, "afterCpPlayer");

      const verySafe = beforeCp >= 700 && afterCp >= 450 && epLoss <= 0.055 && evalLoss <= 150;
      const stillComfortable = afterCp >= 300 && epLoss <= 0.075 && evalLoss <= 190;

      if (verySafe) {
        setType(q, "excellent");
      } else if (stillComfortable) {
        setType(q, "good");
      } else if (q.type === "mistake") {
        setType(q, "inaccuracy");
      }
    }

    // 3) Higher-rated competitive games: do not let genuinely costly quiet
    // moves stay Excellent. But avoid applying this to conversion/endgame cleanup.
    for (const { q } of moves) {
      if (!q || q.type === "book") continue;
      if (sampleBand !== "high") continue;
      if (!["excellent", "good", "inaccuracy"].includes(q.type)) continue;
      if (isSafeConversion(q) || isMateLikeMove(q)) continue;

      const context = q.positionContext || {};
      if (!context.competitive) continue;

      const epLoss = getEpLoss(q);
      const evalLoss = getEvalLoss(q);
      const topMoveGap = getTopMoveGap(q);
      const beforeCp = getCp(q, "beforeCpPlayer");
      const afterCp = getCp(q, "afterCpPlayer");
      const drop = beforeCp - afterCp;

      const realMistake =
        epLoss >= 0.090 ||
        evalLoss >= 190 ||
        (drop >= 240 && epLoss >= 0.060);

      const realInaccuracy =
        epLoss >= 0.050 ||
        evalLoss >= 110 ||
        topMoveGap >= 85 ||
        drop >= 150;

      if (realMistake && q.type !== "mistake") {
        setType(q, "mistake");
      } else if (realInaccuracy && ["excellent", "good"].includes(q.type)) {
        setType(q, "inaccuracy");
      }
    }
  }

  return qualities;
}



// Identical board + side + move must not receive conflicting quality labels
// just because Stockfish's PV order or centipawn score drifted between searches.
// IMPORTANT: ratings/accuracy keep the original measured eval loss; this
// changes only the presentation label and later insights.
function reconcileRepeatedMoveQualities(qualities, fens) {
  if (!Array.isArray(qualities) || !Array.isArray(fens)) return qualities;
  const groups = new Map();
  const seenPositions = new Map();
  const order = { brilliant: 0, great: 0, book: 0, best: 1, excellent: 2,
    good: 3, inaccuracy: 4, mistake: 5, miss: 6, blunder: 7 };

  for (let i = 0; i < qualities.length; i++) {
    const q = qualities[i];
    const fen = String(fens[i] || '');
    if (!q?.uci || !fen) continue;
    const fields = fen.trim().split(/\s+/);
    if (fields.length < 4) continue;
    const boardKey = fields.slice(0, 4).join(' ');
    const priorVisits = seenPositions.get(boardKey) || 0;
    seenPositions.set(boardKey, priorVisits + 1);
    const halfmoveClock = Number(fields[4] || 0);

    // An impending 50-move draw, or threefold claim, can legitimately change
    // the game-theoretic value of otherwise identical positions. Do not merge.
    if (priorVisits >= 2 || halfmoveClock >= 95) continue;
    if (['book', 'brilliant', 'great', 'miss'].includes(q.type)) continue;
    const moveKey = boardKey + ':' + q.uci;
    if (!groups.has(moveKey)) groups.set(moveKey, []);
    groups.get(moveKey).push({ index: i, q });
  }

  for (const peers of groups.values()) {
    if (peers.length < 2) continue;
    // Prevent a genuinely different engine result from being flattened.
    const evalLosses = peers.map(({ q }) => getEvalLoss(q));
    const epLosses = peers.map(({ q }) => getEpLoss(q));
    if (Math.max(...evalLosses) - Math.min(...evalLosses) > 180 ||
        Math.max(...epLosses) - Math.min(...epLosses) > 0.10) continue;

    // If shallow search disagrees, never promote an objectively worse move
    // based on the more optimistic search. Preserve the conservative label.
    const target = peers.reduce((worst, entry) =>
      (order[entry.q.type] ?? 3) > (order[worst.q.type] ?? 3)
        ? entry : worst, peers[0]).q;
    for (const { q } of peers) {
      if (q.type !== target.type) {
        q.type = target.type;
        q.severity = BAD_MOVE_TYPES.has(q.type) ? q.type : null;
        q.repeatedPositionReconciled = true;
      }
    }
  }
  return qualities;
}

function computeMoveQualities(evals, moves, uciMoves, fens, bookMap, openingNameMap = {}) {
  const qualities = [];
  const meta = window.currentGameMeta || {};

  const clampNumber = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
  };

  const getCp = (e) => {
    if (!e) return 0;

    if (e.type === "mate") {
      return isMateForWhite(e) ? 10000 : -10000;
    }

    return Number(e.value || 0);
  };

  const getPlayerRating = (isWhite) => {
    return Number(isWhite ? meta.whiteRating : meta.blackRating) || 1000;
  };

  const getPlayerCp = (evaluation, multiplier) => {
    return getCp(evaluation) * multiplier;
  };

  const expectedPoints = (cpForPlayer, rating) => {
    const r = clampNumber(Number(rating) || 1000, 400, 3400);
    const ratingFactor = clampNumber((r - 400) / 3000, 0, 1);

    const scale = 330 - ratingFactor * 100;
    const capped = clampNumber(cpForPlayer, -1200, 1200);

    return 1 / (1 + Math.exp(-capped / scale));
  };

  const getLineMoves = (evaluation) => {
    const lines = Array.isArray(evaluation?.lines) ? evaluation.lines : [];

    return lines
      .map((line) => line.best_move)
      .filter(Boolean);
  };

  for (let i = 0; i < moves.length; i++) {
    const before = evals[i];
    const after = evals[i + 1] || before;

    const uci = uciMoves[i];
    const san = moves[i] || "";
    const previousSan = moves[i - 1] || "";

    const isWhite = i % 2 === 0;
    const playerMultiplier = isWhite ? 1 : -1;
    const playerRating = getPlayerRating(isWhite);

    const beforeCpPlayer = getPlayerCp(before, playerMultiplier);
    const afterCpPlayer = getPlayerCp(after, playerMultiplier);

    // Cap at the same +/-1200 the expected-points curve uses, so a mate score
    // counts as "completely winning/losing" rather than a 10,000 cp swing.
    // The uncapped before/afterCpPlayer are still used for mate detection.
    const capForLoss = (cp) => clampNumber(cp, -1200, 1200);
    const evalLoss = Math.max(0, capForLoss(beforeCpPlayer) - capForLoss(afterCpPlayer));
    const evalGain = Math.max(0, capForLoss(afterCpPlayer) - capForLoss(beforeCpPlayer));

    const beforeEP = expectedPoints(beforeCpPlayer, playerRating);
    const afterEP = expectedPoints(afterCpPlayer, playerRating);

    const epLoss = Math.max(0, beforeEP - afterEP);
    const epGain = Math.max(0, afterEP - beforeEP);

    const lineMoves = getLineMoves(before);
    const best = before?.best_move || lineMoves[0] || null;
    const second = lineMoves[1] || null;
    const third = lineMoves[2] || null;

    const playedTopLineIndex = lineMoves.indexOf(uci);

    let forced = false;

    try {
      const board = new Chess(fens[i]);
      forced = board.moves().length === 1;
    } catch (e) {
      forced = false;
    }

    const forcedMate = before?.type === "mate";

    const moveNumber = Math.floor(i / 2) + 1;
    const bookKey = fenPositionKey(fens[i]);

    const isTopMove =
      playedTopLineIndex === 0 ||
      uci === best;

    const isNearTopMove =
      uci === second ||
      uci === third ||
      playedTopLineIndex === 1 ||
      playedTopLineIndex === 2;

    const isListedBookMove =
      bookMap &&
      Array.isArray(bookMap[bookKey]) &&
      bookMap[bookKey].includes(uci);

    const isKnownOpeningPosition =
      openingNameMap &&
      Boolean(openingNameMap[bookKey]);

    const previousPlyWasBook =
      i >= 1 &&
      qualities[i - 1]?.type === "book";

    const previousOwnMoveWasBook =
      i >= 2 &&
      qualities[i - 2]?.type === "book";

    const bookSequenceStillConnected =
      moveNumber <= 2 ||
      previousPlyWasBook ||
      previousOwnMoveWasBook;

    const openingBookChainActive =
      moveNumber <= 5 &&
      bookSequenceStillConnected &&
      (
        isListedBookMove ||
        isKnownOpeningPosition ||
        moveNumber <= 2
      );

    const isLowRiskOpeningMove =
      evalLoss <= 75 &&
      epLoss <= 0.045 &&
      (
        isTopMove ||
        isNearTopMove ||
        isKnownOpeningPosition ||
        openingBookChainActive
      );

    // Book has to be a connected opening line, not just "a quiet move that the
    // opening endpoint still knows somewhere". This prevents the fifth/sixth
    // normal developing move from being protected as Book in every game.
    const isEarlyKnownOpeningMove =
      moveNumber <= 2 &&
      openingBookChainActive &&
      isLowRiskOpeningMove;

    const isStrictListedBookMove =
      isListedBookMove &&
      moveNumber <= 5 &&
      bookSequenceStillConnected &&
      isLowRiskOpeningMove;

    const isBook =
      isEarlyKnownOpeningMove ||
      isStrictListedBookMove;

    const isCheckResponse =
      i > 0 &&
      (previousSan.includes("+") || previousSan.includes("#"));

    const isKingMove = san.startsWith("K");
    const isCapture = san.includes("x");
    const givesCheck = san.includes("+") || san.includes("#");

    const isRoutineKingCheckResponse =
      isCheckResponse &&
      isKingMove &&
      !isCapture &&
      !givesCheck &&
      evalGain < 250 &&
      epGain < 0.05;

    const getLineCpForPlayer = (line) => {
      if (!line) return null;

      if (line.type === "mate") {
        return isMateForWhite(line)
          ? 10000 * playerMultiplier
          : -10000 * playerMultiplier;
      }

      return Number(line.value || 0) * playerMultiplier;
    };

    const bestLineCp = getLineCpForPlayer(before?.lines?.[0]);
    const secondLineCp = getLineCpForPlayer(before?.lines?.[1]);

    const topMoveGap =
      bestLineCp !== null && secondLineCp !== null
        ? Math.max(0, bestLineCp - secondLineCp)
        : 0;

    let isRoutineCaptureOrTrade = false;
    let moveShape = null;
    let movedPieceValue = 0;
    let capturedPieceValue = 0;
    let quietMove = false;

    try {
      const shapeBoard = new Chess(fens[i]);
      const shapeMove = getLegalMoveFromUci(shapeBoard, uci);

      if (shapeMove) {
        moveShape = shapeMove;
        movedPieceValue = pieceValue(shapeMove.piece);
        capturedPieceValue = pieceValue(shapeMove.captured);
        quietMove =
          !shapeMove.captured &&
          !san.includes("+") &&
          !san.includes("#");

        isRoutineCaptureOrTrade =
          Boolean(shapeMove.captured) &&
          evalGain < 100 &&
          epGain < 0.018 &&
          topMoveGap < 120;
      }
    } catch (e) {
      isRoutineCaptureOrTrade = false;
    }

    const engineApproved =
      epLoss <= 0.025 &&
      evalLoss <= 70 &&
      (
        isTopMove ||
        isNearTopMove ||
        topMoveGap >= 120
      );

    const positionAlreadyDecisiveForPlayer =
      beforeCpPlayer >= 850 ||
      beforeEP >= 0.88;

    const positionAlreadyDecisiveAgainstPlayer =
      beforeCpPlayer <= -900 ||
      beforeEP <= 0.08;

    const positionStillCompetitive =
      !positionAlreadyDecisiveForPlayer &&
      !positionAlreadyDecisiveAgainstPlayer;

    const createsBigSwing =
      positionStillCompetitive &&
      (
        evalGain >= 260 ||
        epGain >= 0.04
      );

    const savesBadPosition =
      beforeCpPlayer <= -150 &&
      afterCpPlayer >= -50 &&
      (
        evalGain >= 150 ||
        epGain >= 0.05
      );

    const clearlyOnlyGoodMove =
      positionStillCompetitive &&
      topMoveGap >= 260 &&
      evalLoss <= 45 &&
      epLoss <= 0.02 &&
      !isRoutineKingCheckResponse &&
      !isRoutineCaptureOrTrade;

    const winsOrPressuresMaterial =
      moveShape &&
      isCapture &&
      capturedPieceValue > 0 &&
      (
        capturedPieceValue >= movedPieceValue ||
        afterCpPlayer >= beforeCpPlayer + 80 ||
        topMoveGap >= 120
      );

    const findsImportantTacticalResource =
      positionStillCompetitive &&
      engineApproved &&
      !quietMove &&
      (
        winsOrPressuresMaterial ||
        givesCheck ||
        topMoveGap >= 180
      ) &&
      (
        topMoveGap >= 90 ||
        evalGain >= 120 ||
        epGain >= 0.018
      ) &&
      !isRoutineCaptureOrTrade;

    const strongTacticalFind =
      positionStillCompetitive &&
      engineApproved &&
      evalGain >= 220 &&
      epGain >= 0.018 &&
      !isRoutineCaptureOrTrade;

    const moveLooksTactical =
      givesCheck ||
      winsOrPressuresMaterial ||
      topMoveGap >= 160 ||
      evalGain >= 180 ||
      epGain >= 0.03;

    const isOrdinaryBestMove =
      isTopMove &&
      !savesBadPosition &&
      !clearlyOnlyGoodMove &&
      !createsBigSwing &&
      !moveLooksTactical;

    const likelyGreatMove =
      !isBook &&
      !forced &&
      !forcedMate &&
      !isRoutineKingCheckResponse &&
      !isRoutineCaptureOrTrade &&
      engineApproved &&
      !positionAlreadyDecisiveForPlayer &&
      !isOrdinaryBestMove &&
      (
        savesBadPosition ||
        clearlyOnlyGoodMove ||
        (
          moveLooksTactical &&
          (
            createsBigSwing ||
            topMoveGap >= 180 ||
            evalGain >= 220 ||
            epGain >= 0.04
          )
        )
      );

    let isBrilliantMove = false;
    let brilliantReason = null;

    try {
      const boardBefore = new Chess(fens[i]);
      const materialBefore = getMaterialBalance(boardBefore);

      const boardAfter = new Chess(fens[i]);
      const moveObj = getLegalMoveFromUci(boardAfter, uci);

      if (moveObj) {
        const materialAfter = getMaterialBalance(boardAfter);

        const materialChangeForPlayer =
          (materialAfter - materialBefore) * playerMultiplier;

        const movedPieceValue = pieceValue(moveObj.piece);
        const capturedPieceValue = pieceValue(moveObj.captured);
        const movedToSquare = moveObj.to;

        const isRealPiece =
          movedPieceValue >= 3 &&
          movedPieceValue < 100;

        const quietMove =
          !moveObj.captured &&
          !san.includes("+") &&
          !san.includes("#");

        const moveIsEngineApproved =
          epLoss <= 0.045 &&
          (
            isTopMove ||
            isNearTopMove ||
            likelyGreatMove
          );

        const positionStillPlayable =
          beforeCpPlayer > -900 &&
          afterCpPlayer > -900;

        const positionIsNotAlreadyDead =
          beforeCpPlayer > -1000 &&
          afterCpPlayer > -1000;

        const hasRealCompensation =
          evalGain >= 180 ||
          epGain >= 0.018 ||
          topMoveGap >= 180;

        const sacrificesMaterialNow =
          materialChangeForPlayer <= -2;

        const immediateSacrificeBrilliant =
          sacrificesMaterialNow &&
          moveIsEngineApproved &&
          positionIsNotAlreadyDead &&
          hasRealCompensation;

        const isMovedPieceHanging =
          isRealPiece &&
          !moveObj.captured &&
          opponentCanCaptureSquare(boardAfter, movedToSquare);

        const hangingPieceBrilliant =
          isMovedPieceHanging &&
          moveIsEngineApproved &&
          positionIsNotAlreadyDead &&
          hasRealCompensation;

        const capturesLowerValuePiece =
          Boolean(moveObj.captured) &&
          movedPieceValue > capturedPieceValue &&
          materialChangeForPlayer <= 0 &&
          opponentCanCaptureSquare(boardAfter, movedToSquare);

        const lowerValueCaptureBrilliant =
          capturesLowerValuePiece &&
          moveIsEngineApproved &&
          positionIsNotAlreadyDead &&
          hasRealCompensation;

        const opponentThreatsAfter =
          getOpponentCapturesOfValuablePieces(boardAfter);

        const queenThreatsAfter = opponentThreatsAfter.filter((threat) => {
          return threat.capturedPiece === "q";
        });

        const rookThreatsAfter = opponentThreatsAfter.filter((threat) => {
          return threat.capturedPiece === "r";
        });

        const queenStillHanging =
          queenThreatsAfter.length > 0;

        const rookStillHanging =
          rookThreatsAfter.length > 0;

        const movedThreatenedQueen =
          queenThreatsAfter.some((threat) => {
            return threat.square === moveObj.from;
          });

        const capturedQueenAttacker =
          queenThreatsAfter.some((threat) => {
            return moveObj.to === threat.attackerFrom;
          });

        const moveDidNotAddressQueenThreat =
          movedPieceValue !== 9 &&
          !movedThreatenedQueen &&
          !capturedQueenAttacker;

        const ignoresQueenThreat =
          quietMove &&
          !isKingMove &&
          !isRoutineKingCheckResponse &&
          queenStillHanging &&
          moveDidNotAddressQueenThreat;

        const engineSaysQueenThreatIsPoisoned =
          ignoresQueenThreat &&
          positionStillPlayable &&
          moveIsEngineApproved &&
          epLoss <= 0.02 &&
          afterCpPlayer >= beforeCpPlayer - 60 &&
          (
            isTopMove ||
            isNearTopMove ||
            topMoveGap >= 50
          );

        const ignoresRookThreat =
          quietMove &&
          !isKingMove &&
          !isRoutineKingCheckResponse &&
          rookStillHanging &&
          movedPieceValue < 5;

        const engineSaysRookThreatIsPoisoned =
          ignoresRookThreat &&
          positionStillPlayable &&
          moveIsEngineApproved &&
          epLoss <= 0.02 &&
          afterCpPlayer >= beforeCpPlayer - 40 &&
          (
            isTopMove ||
            topMoveGap >= 120 ||
            epGain >= 0.015
          );

        const ignoredThreatBrilliant =
          engineSaysQueenThreatIsPoisoned ||
          engineSaysRookThreatIsPoisoned;

        const rawPv =
          Array.isArray(after?.lines) && after.lines[0]
            ? after.lines[0].pv
            : [];

        const bestPvAfterMove =
          Array.isArray(rawPv)
            ? rawPv
            : typeof rawPv === "string"
              ? rawPv.split(/\s+/).filter(Boolean)
              : [];

        const pvMaterialGain =
          pvMaterialGainForPlayer(
            boardAfter,
            bestPvAfterMove,
            playerMultiplier,
            6
          );

        const createsMateThreat =
          after?.type === "mate" &&
          afterCpPlayer > 0;

        const quietTacticalBrilliant =
          quietMove &&
          !isKingMove &&
          !isRoutineKingCheckResponse &&
          moveIsEngineApproved &&
          positionIsNotAlreadyDead &&
          (
            createsMateThreat ||
            pvMaterialGain >= 3
          ) &&
          (
            evalGain >= 180 ||
            epGain >= 0.018 ||
            topMoveGap >= 180
          );

        const realSacrificeBrilliant =
          immediateSacrificeBrilliant ||
          hangingPieceBrilliant ||
          lowerValueCaptureBrilliant;

        const poisonedMajorPieceBrilliant =
          ignoredThreatBrilliant &&
          moveIsEngineApproved &&
          epLoss <= 0.018 &&
          afterCpPlayer >= beforeCpPlayer - 35 &&
          (
            topMoveGap >= 160 ||
            evalGain >= 180 ||
            epGain >= 0.025
          );

        const canBeBrilliant =
          !isBook &&
          !forced &&
          !forcedMate &&
          !isKingMove &&
          !isRoutineKingCheckResponse &&
          beforeCpPlayer < 450 &&
          beforeEP < 0.78 &&
          afterCpPlayer > -700;

        if (
          canBeBrilliant &&
          (
            realSacrificeBrilliant ||
            poisonedMajorPieceBrilliant
          )
        ) {
          isBrilliantMove = true;

          if (immediateSacrificeBrilliant) {
            brilliantReason = "material sacrifice";
          } else if (hangingPieceBrilliant) {
            brilliantReason = "hanging-piece sacrifice";
          } else if (lowerValueCaptureBrilliant) {
            brilliantReason = "poisoned capture";
          } else if (engineSaysQueenThreatIsPoisoned) {
            brilliantReason = "ignored queen threat";
          } else if (engineSaysRookThreatIsPoisoned) {
            brilliantReason = "ignored rook threat";
          }
        }
      }
    } catch (e) {
      isBrilliantMove = false;
      brilliantReason = null;
    }

    const isHighRatedPlayer = playerRating >= 1350;
    const isLowRatedPlayer = playerRating < 700;

    const contextBeforeMateForPlayer =
      beforeCpPlayer >= 9000;

    const contextAfterMateAgainstPlayer =
      afterCpPlayer <= -9000;

    const contextWinning =
      contextBeforeMateForPlayer ||
      beforeCpPlayer >= 500 ||
      beforeEP >= 0.82;

    const contextClearlyBetter =
      beforeCpPlayer >= 250 ||
      beforeEP >= 0.68;

    const contextRemainsWinning =
      afterCpPlayer >= 350 ||
      afterEP >= 0.74;

    const contextStillPlayableAfter =
      afterCpPlayer > -650 &&
      afterEP > 0.10;

    const contextCompetitive =
      beforeCpPlayer > -450 &&
      beforeCpPlayer < 650 &&
      beforeEP > 0.12 &&
      beforeEP < 0.90;

    const conversionKeepsAWin =
      !contextAfterMateAgainstPlayer &&
      contextWinning &&
      contextRemainsWinning &&
      evalLoss <= 180 &&
      epLoss <= 0.075;

    const conversionStaysComfortable =
      !contextAfterMateAgainstPlayer &&
      contextClearlyBetter &&
      contextStillPlayableAfter &&
      afterCpPlayer >= 150 &&
      evalLoss <= 230 &&
      epLoss <= 0.090;

    let type = "good";
    let sev = null;

    if (isBook) {
      type = "book";
    }

    else if (forced) {
      type = "best";
    }

    else if (isBrilliantMove) {
      type = "brilliant";
    }

    else if (likelyGreatMove && !isTopMove) {
      type = "great";
    }

    else if (isTopMove) {
      type = likelyGreatMove ? "great" : "best";
    }

    // Excellent is decided by how little the move loses, not by whether it
    // happened to rank in Stockfish's top 3 lines (a 4th-ranked move losing
    // 0.017 EP is just as good as a 3rd-ranked move losing 0.017 EP).
    // (Never when the move throws away a forced mate: capped at +/-1200 a
    // mate and a +13 position look identical to the loss maths.)
    else if (
      epLoss <= 0.025 &&
      evalLoss <= 80 &&
      !(beforeCpPlayer >= 9000 && afterCpPlayer < 9000)
    ) {
      type = likelyGreatMove ? "great" : "excellent";
    }

    // Chess.com is noticeably more forgiving when the player is converting a
    // clearly winning position and the move keeps that win intact. Without this,
    // harmless +6 -> +4 conversion moves become fake Inaccuracies/Mistakes.
    else if (conversionKeepsAWin) {
      type = epLoss <= 0.045 && evalLoss <= 120 ? "excellent" : "good";
    }

    else if (conversionStaysComfortable && isLowRatedPlayer) {
      type = "good";
    }

    else {
      const thresholds = getEpErrorThresholds(playerRating, beforeEP);

      const beforeMateForPlayer =
        beforeCpPlayer >= 9000;

      const afterMateAgainstPlayer =
        afterCpPlayer <= -9000;

      const alreadyCompletelyLost =
        beforeCpPlayer <= -1800 ||
        beforeEP <= 0.025;

      const beforeWinning =
        beforeMateForPlayer ||
        beforeCpPlayer >= 500 ||
        beforeEP >= 0.82;

      const beforeClearlyBetter =
        beforeCpPlayer >= 250 ||
        beforeEP >= 0.68;

      const beforePlayable =
        beforeCpPlayer >= -650 &&
        beforeEP >= 0.12;

      const beforeOkayOrBetter =
        beforeCpPlayer >= -250 &&
        beforeEP >= 0.24;

      const afterLost =
        afterCpPlayer <= -900 ||
        afterEP <= 0.08;

      const afterVeryBad =
        afterCpPlayer <= -450 ||
        afterEP <= 0.16;

      const afterStillHasGame =
        afterCpPlayer >= -450 &&
        afterEP >= 0.12;

      const conversionForgivenessApplies =
        conversionKeepsAWin ||
        (
          isLowRatedPlayer &&
          conversionStaysComfortable
        );

      const highRatedCompetitiveMistake =
        isHighRatedPlayer &&
        positionStillCompetitive &&
        !beforeWinning &&
        beforePlayable &&
        !isTopMove &&
        evalLoss >= 115 &&
        epLoss >= 0.040 &&
        (
          topMoveGap >= 35 ||
          afterCpPlayer <= beforeCpPlayer - 110
        );

      const highRatedCompetitiveInaccuracy =
        isHighRatedPlayer &&
        positionStillCompetitive &&
        !isTopMove &&
        evalLoss >= 60 &&
        epLoss >= 0.026 &&
        (
          topMoveGap >= 25 ||
          afterCpPlayer <= beforeCpPlayer - 70
        );

      // Miss = failed to take a clear chance, but did not instantly destroy the game.
      const missedForcedMate =
        !isTopMove &&
        beforeMateForPlayer &&
        !afterMateAgainstPlayer;

      const missedForcedWin =
        !isTopMove &&
        beforeCpPlayer >= 900 &&
        evalLoss >= 450 &&
        epLoss >= 0.10 &&
        afterStillHasGame;

      const missedWinningChance =
        !isTopMove &&
        beforeClearlyBetter &&
        topMoveGap >= 130 &&
        evalLoss >= 200 &&
        epLoss >= 0.075 &&
        epLoss <= 0.42 &&
        afterStillHasGame;

      const missedOnlyGoodMove =
        !isTopMove &&
        beforePlayable &&
        topMoveGap >= 240 &&
        evalLoss >= 150 &&
        epLoss >= 0.07 &&
        epLoss <= 0.38 &&
        afterStillHasGame;

      const isMissOpportunity =
        !alreadyCompletelyLost &&
        (
          missedForcedMate ||
          missedForcedWin ||
          missedWinningChance ||
          missedOnlyGoodMove
        );

      // Blunder = move destroys a playable/winning game.
      // Allowing mate from an already-lost position costs almost no expected
      // points, so it should not automatically be a blunder.
      const walksIntoMate =
        !alreadyCompletelyLost &&
        afterMateAgainstPlayer &&
        epLoss >= thresholds.mistake;

      const playableToLost =
        !alreadyCompletelyLost &&
        beforePlayable &&
        afterLost &&
        (
          epLoss >= thresholds.blunder * 0.75 ||
          evalLoss >= 550
        );

      const winningToVeryBad =
        !alreadyCompletelyLost &&
        beforeWinning &&
        afterVeryBad &&
        (
          epLoss >= thresholds.blunder * 0.65 ||
          evalLoss >= 500
        );

      const hugeEpCollapse =
        !alreadyCompletelyLost &&
        epLoss >= thresholds.blunder &&
        afterVeryBad;

      const hugeEvalCollapse =
        !alreadyCompletelyLost &&
        evalLoss >= 700 &&
        afterVeryBad;

      const tacticalCollapse =
        !alreadyCompletelyLost &&
        beforeOkayOrBetter &&
        afterVeryBad &&
        evalLoss >= 320 &&
        (
          epLoss >= thresholds.mistake ||
          topMoveGap >= 170
        );

      const materialBlunder =
        !alreadyCompletelyLost &&
        beforeCpPlayer > -700 &&
        afterCpPlayer <= beforeCpPlayer - 420 &&
        evalLoss >= 380 &&
        (
          epLoss >= thresholds.mistake ||
          afterCpPlayer <= -450
        );

      const isBlunder =
        walksIntoMate ||
        playableToLost ||
        winningToVeryBad ||
        hugeEpCollapse ||
        hugeEvalCollapse ||
        tacticalCollapse ||
        materialBlunder;

      const mistakeFloor =
        Math.max(thresholds.mistake * 0.72, 0.085);

      const isMistake =
        !isBlunder &&
        !isMissOpportunity &&
        !conversionForgivenessApplies &&
        (
          highRatedCompetitiveMistake ||
          epLoss >= mistakeFloor ||
          (evalLoss >= 220 && epLoss >= 0.055) ||
          (evalLoss >= 130 && epLoss >= 0.085) ||
          (
            beforeClearlyBetter &&
            afterCpPlayer < 80 &&
            evalLoss >= 180
          ) ||
          (
            beforePlayable &&
            afterCpPlayer <= beforeCpPlayer - 240 &&
            epLoss >= thresholds.inaccuracy
          )
        );

      // Good gets checked BEFORE inaccuracy.
      // This catches harmless suboptimal moves that Chess.com usually calls Good.
      const quietMove =
        !givesCheck &&
        !isCapture &&
        !winsOrPressuresMaterial &&
        topMoveGap < 140;

      const stillPlayableAfter =
        afterCpPlayer > -650 &&
        afterEP > 0.10;

      // Only forgive genuinely harmless quiet moves. This keeps random 0.06 EP
      // losses from becoming Good in competitive/high-rated games.
      const softErrorShouldBeForgiven =
        quietMove &&
        stillPlayableAfter &&
        epLoss < 0.055 &&
        evalLoss < 95 &&
        topMoveGap <= 35 &&
        !beforeWinning &&
        !createsBigSwing &&
        !highRatedCompetitiveInaccuracy;

      // Middle zone: not always a Mistake, but too costly for Good.
      const quietMoveHasRealCost =
        quietMove &&
        stillPlayableAfter &&
        (
          epLoss >= 0.058 ||
          evalLoss >= 100 ||
          topMoveGap >= 45 ||
          afterCpPlayer <= -300 ||
          highRatedCompetitiveInaccuracy
        );

      // Good should be for small playable losses or safe winning conversions.
      const isGoodButNotBest =
        !isBlunder &&
        !isMissOpportunity &&
        !isMistake &&
        afterCpPlayer > -650 &&
        (
          conversionForgivenessApplies ||
          (
            !quietMoveHasRealCost &&
            epLoss < Math.max(thresholds.inaccuracy * 0.9, 0.045) &&
            evalLoss < 90 &&
            (
              isNearTopMove ||
              topMoveGap <= 70 ||
              epLoss < 0.03 ||
              evalLoss < 55
            )
          ) ||
          softErrorShouldBeForgiven
        );

      const inaccuracyFloor =
        Math.max(thresholds.inaccuracy * 0.95, isHighRatedPlayer ? 0.045 : 0.055);

      const inaccuracyHasConsequence =
        quietMoveHasRealCost ||
        highRatedCompetitiveInaccuracy ||
        topMoveGap >= 55 ||
        evalLoss >= 100 ||
        afterCpPlayer <= -300 ||
        (
          beforeClearlyBetter &&
          afterCpPlayer < beforeCpPlayer - 80
        );

      // Expected points are flat in lost positions, so hanging mate there barely
      // registers. Still never call it Good/Excellent unless the game was already
      // totally lost or the move was the engine's top choice.
      const allowsAvoidableMate =
        afterMateAgainstPlayer &&
        beforeCpPlayer > -9000 &&
        !alreadyCompletelyLost &&
        !isTopMove;

      const isInaccuracy =
        !isBlunder &&
        !isMissOpportunity &&
        !isMistake &&
        !isGoodButNotBest &&
        !conversionForgivenessApplies &&
        (
          allowsAvoidableMate ||
          (
            epLoss >= inaccuracyFloor &&
            inaccuracyHasConsequence
          ) ||
          (
            evalLoss >= 120 &&
            epLoss >= 0.04
          ) ||
          (
            beforeClearlyBetter &&
            evalLoss >= 90 &&
            epLoss >= 0.035
          )
        );

      if (isBlunder) {
        type = "blunder";
        sev = "blunder";
      }

      else if (isMissOpportunity) {
        type = "miss";
        sev = "miss";
      }

      else if (isMistake) {
        type = "mistake";
        sev = "mistake";
      }

      else if (isGoodButNotBest) {
        type = "good";
      }

      else if (isInaccuracy) {
        type = "inaccuracy";
        sev = "inaccuracy";
      }

      else {
        type = "excellent";
      }
    }

    const insight = generateMoveInsight({
      moveSan: moves[i],
      quality: type,
      severity: sev,
      evalLoss,
      evalGain,
      engineBest: best,
    });

    qualities.push({
      type,
      severity: sev,
      engineBest: best,
      uci,
      forced,
      forcedMate,
      evalLoss,
      evalGain,
      epLoss,
      epGain,
      winLoss: epLoss,

      beforeCpPlayer,
      afterCpPlayer,
      beforeExpectedPoints: beforeEP,
      afterExpectedPoints: afterEP,
      playedTopLineIndex,
      topMoveGap,
      likelyGreatMove,
      positionContext: {
        ratingBand: isLowRatedPlayer ? "low" : isHighRatedPlayer ? "high" : "mid",
        competitive: contextCompetitive,
        winning: contextWinning,
        keepsWin: conversionKeepsAWin,
        comfortable: conversionStaysComfortable,
      },

      isCheckResponse,
      isKingMove,
      isCapture,
      givesCheck,
      routineCheckResponse: isRoutineKingCheckResponse,

      isBrilliantMove,
      brilliantReason,

      insight,
    });
  }

  const movesForPromotion =
    window.analysisResult?.moves ||
    window.analysisResult?.game?.moves ||
    moves ||
    [];

  applyStrictSpecialMovePromotions(qualities, movesForPromotion);

  for (let i = 0; i < qualities.length; i++) {
    qualities[i] = applyMoveQualitySanityCheck(qualities[i]);
  }

  normalizeRoutineBestMoveCounts(qualities);
  normalizeGreatMoveCounts(qualities);
  normalizeExcellentAndSoftErrorBalance(qualities);
  normalizeMiddleBucketSeverity(qualities);
  // Reconcile AFTER game-wide count adjustments; they can otherwise assign
  // different categories to repeated identical positions.
  reconcileRepeatedMoveQualities(qualities, fens);

  qualities.forEach((q, i) => {
    if (!q) return;

    // Phase 1: verified tactical facts are independent of the move-quality
    // classifier. They are exposed for future insight / brilliant workflows.
    q.tactics = window.ChessTactics?.analyzeMove?.(fens[i], q.uci) || null;
    const playedEnglish = describeMoveInEnglishFromFen(fens[i], q.uci);
    const bestEnglish = describeBestOptionInEnglish(fens[i], q.engineBest);
    const insight = generateMoveInsight({
      moveSan: moves[i],
      quality: q.type,
      severity: q.severity,
      evalLoss: q.evalLoss,
      evalGain: q.evalGain,
      engineBest: bestEnglish,
    });

    const qualityLabel = {
      book: "a book move",
      brilliant: "a brilliant move",
      great: "a great move",
      best: "the best move",
      excellent: "an excellent move",
      good: "a good move",
      inaccuracy: "an inaccuracy",
      mistake: "a mistake",
      miss: "a missed opportunity",
      blunder: "a blunder",
    }[q.type || q.severity] || "a solid move";
    if (playedEnglish) {
      // The move list keeps algebraic notation; the coach speaks plain English.
      insight.title = `${playedEnglish} — ${qualityLabel}`;
    }

    // Derive the explanation *after* all quality normalization, so any
    // promotion/demotion is reflected in both the insight and its arrows.
    q.idea = ["book", "best", "excellent", "good", "great", "brilliant"]
      .includes(q.type)
      ? deriveMoveIdea(q, i, window.analysisResult)
      : null;
    q.badMoveLesson = ["inaccuracy", "mistake", "miss", "blunder"]
      .includes(q.severity)
      ? deriveBadMoveLesson(q, i, window.analysisResult)
      : null;
    q.insight = {
      ...insight,
      text: q.idea?.text || q.badMoveLesson?.text || insight.text,
    };
  });

  window.moveQualities = qualities;
  window.moveContexts = qualities;

  return qualities;
}

// Check integration after loading a game: debugChessTactics(31) uses the
// zero-based ply. With no argument it checks the currently selected move.
window.debugChessTactics = function debugChessTactics(ply = window.currentMoveIndex - 1) {
  const result = window.analysisResult;
  const q = window.moveQualities?.[ply];
  const fen = result?.fens?.[ply];
  const raw = q?.uci && fen && window.ChessTactics?.analyzeMove?.(fen, q.uci);
  const output = {
    uiVersion: window.CHESS_TACTICS_UI_VERSION,
    tacticsLoaded: typeof window.ChessTactics?.analyzeMove === 'function',
    ply, fen, uci: q?.uci,
    tacticalEvidence: raw || null,
    coachText: q?.insight?.text || null,
    arrows: q?.idea?.arrows || [],
  };
  console.log('Tactical integration diagnostic:', output);
  return output;
};

window.dumpMoveDebug = function dumpMoveDebug() {
  const result = window.analysisResult || {};
  const qualities = window.moveQualities || [];
  const rows = qualities.map((q, i) => ({
    ply: i + 1,
    move: result.moves?.[i] || "",
    side: i % 2 === 0 ? "white" : "black",
    type: q?.type,
    scoringType: q?.scoringType || q?.type,
    evalLoss: Number(q?.evalLoss || 0).toFixed(0),
    epLoss: Number(q?.epLoss || 0).toFixed(3),
    topMoveGap: Number(q?.topMoveGap || 0).toFixed(0),
    beforeCp: Number(q?.beforeCpPlayer || 0).toFixed(0),
    afterCp: Number(q?.afterCpPlayer || 0).toFixed(0),
    context: q?.positionContext
      ? JSON.stringify(q.positionContext)
      : "",
  }));

  console.table(rows);
  return rows;
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function qualityDisplayName(type, severity) {
  const key = severity || type;

  if (key === "brilliant") return "Brilliant";
  if (key === "great") return "Great";
  if (key === "best") return "Best";
  if (key === "excellent") return "Excellent";
  if (key === "book") return "Book";
  if (key === "good") return "Good";
  if (key === "inaccuracy") return "Inaccuracy";
  if (key === "mistake") return "Mistake";
  if (key === "miss") return "Miss";
  if (key === "blunder") return "Blunder";

  return "Good";
}


function applyMoveQualitySanityCheck(q) {
  if (!q || !q.type) return q;

  const out = { ...q };

  // Preserve the original type for accuracy/rating math.
  // The sanity check can change the displayed label without wrecking accuracy.
  out.scoringType = out.scoringType || out.type;
  out.scoringSeverity = out.scoringSeverity || out.severity;

  if (out.type === "book") return out;

  const epLoss = Math.max(0, Number(out.epLoss ?? out.winLoss ?? 0));
  const evalLoss = Math.max(0, Number(out.evalLoss || 0));
  const topMoveGap = Math.max(0, Number(out.topMoveGap || 0));

  const beforeCp = Number(out.beforeCpPlayer ?? out.beforeCp ?? 0);
  const afterCp = Number(out.afterCpPlayer ?? out.afterCp ?? 0);

  const improvement = afterCp - beforeCp;
  const drop = beforeCp - afterCp;

  const mateLike =
    Math.abs(beforeCp) >= 9000 ||
    Math.abs(afterCp) >= 9000;

  const alreadyCompletelyLost =
    beforeCp <= -900 &&
    afterCp <= -900;

  const alreadyCompletelyWinning =
    beforeCp >= 1200 &&
    afterCp >= 900;

  const decidedPosition =
    alreadyCompletelyLost ||
    alreadyCompletelyWinning;

  const safeWinningConversion =
    beforeCp >= 450 &&
    afterCp >= 300 &&
    epLoss <= 0.08 &&
    evalLoss <= 210;

  const severeRank = {
    inaccuracy: 1,
    mistake: 2,
    miss: 3,
    blunder: 4,
  };

  function promoteTo(type) {
    const currentRank = severeRank[out.type] || 0;
    const targetRank = severeRank[type] || 0;

    if (targetRank > currentRank) {
      out.type = type;
      out.severity = type;
    }
  }

  // -----------------------------
  // 1. Severe move sanity check
  // -----------------------------
  // Only promote bad labels if the position was not already completely decided.
  // This prevents random endgame/forced-mate weirdness from creating fake blunders.
  if (!mateLike && !decidedPosition && !safeWinningConversion) {
    const positionFlipLoss =
      (beforeCp >= 150 && afterCp <= -50) ||
      (beforeCp >= 50 && afterCp <= -250) ||
      (beforeCp >= -50 && afterCp <= -350);

    const catastrophicLoss =
      epLoss >= 0.245 ||
      evalLoss >= 650 ||
      (positionFlipLoss && epLoss >= 0.18) ||
      (drop >= 500 && epLoss >= 0.16) ||
      (beforeCp > -100 && afterCp < -650);

    const majorLoss =
      epLoss >= 0.17 ||
      evalLoss >= 380 ||
      (beforeCp >= 250 && afterCp <= -100) ||
      drop >= 420;

    const mediumLoss =
      epLoss >= 0.12 ||
      evalLoss >= 280 ||
      drop >= 350;

    const smallLoss =
      epLoss >= 0.065 ||
      evalLoss >= 150 ||
      drop >= 200;

    if (catastrophicLoss) {
      promoteTo("blunder");
    } else if (majorLoss) {
      promoteTo("miss");
    } else if (mediumLoss) {
      promoteTo("mistake");
    } else if (smallLoss) {
      promoteTo("inaccuracy");
    }
  }

  // -----------------------------
  // 2. Fake great/brilliant cleanup
  // -----------------------------
  // Great/brilliant should need real context. A normal capture/check in a
  // winning conversion should not become Great just because the engine likes it.
  const greatPositionStillMeaningful =
    !mateLike &&
    beforeCp > -650 &&
    beforeCp < 650;

  const hasTacticalSignal =
    out.savedPosition ||
    out.sacrificesMaterial ||
    topMoveGap >= 220 ||
    improvement >= 220 ||
    (out.givesCheck && (topMoveGap >= 160 || improvement >= 120)) ||
    (out.isCapture && (topMoveGap >= 180 || improvement >= 140)) ||
    Number(out.difficultyScore || 0) >= 0.75;

  if (out.type === "great" && (!greatPositionStillMeaningful || !hasTacticalSignal)) {
    if (epLoss <= 0.025 && evalLoss <= 35) {
      out.type = "best";
      out.severity = null;
    } else {
      out.type = "excellent";
      out.severity = null;
    }
  }

  if (out.type === "brilliant") {
    const hasBrilliantSignal =
      out.sacrificesMaterial ||
      out.savedPosition ||
      (greatPositionStillMeaningful && hasTacticalSignal && improvement >= 300);

    if (!hasBrilliantSignal) {
      out.type = "great";
      out.severity = null;
    }
  }

  // -----------------------------
  // 3. Conservative Great promotion pass
  // -----------------------------
  // Keep this rare. The previous version promoted too many clean endgame
  // conversions, especially captures/checks while already winning.
  const canPromoteToGreat =
    ["best", "excellent", "good"].includes(out.type) &&
    !["inaccuracy", "mistake", "miss", "blunder"].includes(out.severity);

  const cleanEnoughForGreat =
    epLoss <= 0.025 &&
    evalLoss <= 45;

  const onlyMoveCleanEnough =
    epLoss <= 0.045 &&
    evalLoss <= 75;

  const notRoutineConversion =
    !(beforeCp >= 450 && afterCp >= 450 && !out.savedPosition && !out.sacrificesMaterial);

  const savedOrSwungPosition =
    out.savedPosition === true ||
    (beforeCp <= -120 && improvement >= 180 && afterCp > -500) ||
    (beforeCp < 250 && improvement >= 300);

  const onlyMoveFind =
    topMoveGap >= 260 &&
    afterCp >= -100 &&
    onlyMoveCleanEnough;

  const forcingTacticFind =
    (
      out.sacrificesMaterial ||
      out.savedPosition ||
      (out.givesCheck && topMoveGap >= 220) ||
      (out.isCapture && topMoveGap >= 240)
    ) &&
    improvement >= 120 &&
    cleanEnoughForGreat;

  const explicitLikelyGreat =
    out.likelyGreatMove === true &&
    onlyMoveCleanEnough &&
    (
      savedOrSwungPosition ||
      onlyMoveFind ||
      topMoveGap >= 240 ||
      improvement >= 220
    );

  if (
    canPromoteToGreat &&
    greatPositionStillMeaningful &&
    notRoutineConversion &&
    (
      savedOrSwungPosition ||
      onlyMoveFind ||
      forcingTacticFind ||
      explicitLikelyGreat
    )
  ) {
    out.type = "great";
    out.severity = null;
  }

  return out;
}

function moveAccuracyFromWinLoss(q, baseRating = 1000) {
  if (!q) return 100;

  const type = q.scoringType || q.type;
  const severity = q.scoringSeverity || q.severity;

  if (type === "book") return null;

  const epLoss = Math.max(0, Number(q.epLoss ?? q.winLoss ?? 0));
  const loss = Math.max(0, Number(q.evalLoss || 0));

  const beforeCp = Number(q.beforeCpPlayer ?? q.beforeCp ?? 0);
  const afterCp = Number(q.afterCpPlayer ?? q.afterCp ?? 0);

  const isMateLike =
    Math.abs(beforeCp) >= 9000 ||
    Math.abs(afterCp) >= 9000;

  const isQuietCleanup =
    isMateLike &&
    epLoss <= 0.005 &&
    loss <= 50 &&
    ["best", "excellent", "good"].includes(type);

  // Do not let forced-mate / completely decided cleanup moves inflate accuracy.
  // These moves should still appear in move quality, but not heavily affect accuracy.
  if (isQuietCleanup) return null;

  // Sometimes mate scores flip between +10000 and -10000 when converting
  // engine perspective to player perspective. If the classifier still says
  // the move is clean, do not let that fake 10k/20k loss damage accuracy.
  const isCleanType = ["brilliant", "great", "best", "excellent", "good"].includes(type);
  if (isMateLike && isCleanType && !severity && loss >= 9000) {
    if (["brilliant", "great", "best"].includes(type)) return 100;
    return null;
  }

  if (type === "brilliant") return clamp(100 - epLoss * 20, 97, 100);
  if (type === "great") return clamp(98 - epLoss * 25, 94, 99);
  if (type === "best") return clamp(96 - epLoss * 18, 91, 98);
  if (type === "excellent") return clamp(90 - epLoss * 36, 82, 94);
  if (type === "good") return clamp(80 - epLoss * 50, 68, 87);

  const epScore = 100 * Math.exp(-5.25 * epLoss);
  const cpScore = 100 * Math.exp(-loss / 470);

  let accuracy = epScore * 0.82 + cpScore * 0.18;

  if (severity === "inaccuracy" || type === "inaccuracy") accuracy *= 0.965;
  if (severity === "mistake" || type === "mistake") accuracy *= 0.90;
  if (severity === "miss" || type === "miss") accuracy *= 0.86;
  if (severity === "blunder" || type === "blunder") accuracy *= 0.70;

  return clamp(accuracy, 0, 100);
}


function applyGameMessinessPenalty(rawAccuracy, playerMoves) {
  const moves = (playerMoves || []).filter(q => {
    const type = q?.scoringType || q?.type;
    return q && type !== "book";
  });

  if (!moves.length) return rawAccuracy;

  const seriousTypes = new Set(["inaccuracy", "mistake", "miss", "blunder"]);

  const seriousMoves = moves.filter(q => {
    const type = q.scoringType || q.type;
    const severity = q.scoringSeverity || q.severity;
    return seriousTypes.has(type) || seriousTypes.has(severity);
  }).length;

  const disasterMoves = moves.filter(q => {
    const type = q.scoringType || q.type;
    const severity = q.scoringSeverity || q.severity;
    const key = severity || type;

    return (
      key === "miss" ||
      key === "blunder" ||
      Number(q.epLoss || 0) >= 0.20 ||
      overviewLossForRating(q) >= 350
    );
  }).length;

  const avgEpLoss =
    moves.reduce((sum, q) => sum + Math.max(0, Number(q.epLoss || 0)), 0) /
    moves.length;

  const seriousRate = seriousMoves / moves.length;
  const disasterRate = disasterMoves / moves.length;

  let penalty = 0;

  // Keep this soft. Accuracy is already penalized move-by-move, so this is
  // only a small correction for very chaotic games, not a second full scoring pass.
  penalty += Math.max(0, seriousRate - 0.22) * 8;
  penalty += Math.max(0, disasterRate - 0.10) * 10;
  penalty += Math.max(0, avgEpLoss - 0.095) * 14;

  penalty = clamp(penalty, 0, 2.5);

  return clamp(rawAccuracy - penalty, 0, 100);
}


function overviewLossForRating(q) {
  if (!q) return 0;

  const rawLoss = Math.max(0, Number(q.evalLoss || 0));
  const beforeCp = Math.abs(Number(q.beforeCpPlayer ?? q.beforeCp ?? 0));
  const afterCp = Math.abs(Number(q.afterCpPlayer ?? q.afterCp ?? 0));
  const isMateSentinel = rawLoss >= 9000 || beforeCp >= 9000 || afterCp >= 9000;

  const key = q.scoringSeverity || q.scoringType || q.severity || q.type;
  const isCleanMove = ["book", "brilliant", "great", "best", "excellent", "good"].includes(key);

  // Mate-score transitions can create fake 10k/20k centipawn losses.
  // For clean moves, ignore them. For real errors, cap them so one mate
  // transition does not crush the whole estimated rating.
  if (isMateSentinel) {
    return isCleanMove ? 0 : Math.min(rawLoss, 650);
  }

  return Math.min(rawLoss, 650);
}

function getExpectedAccuracy(rating) {
  const table = [
    [3400, 93],
    [3000, 90],
    [2600, 87],
    [2200, 83],
    [1800, 78],
    [1400, 72],
    [1200, 67],
    [800, 59],
    [400, 50],
  ];

  const r = clamp(Number(rating) || 1200, 400, 3400);

  for (let i = 0; i < table.length - 1; i++) {
    const [r1, a1] = table[i];
    const [r2, a2] = table[i + 1];

    if (r >= r2) {
      const t = (r - r2) / (r1 - r2);
      return a2 + t * (a1 - a2);
    }
  }

  return 50;
}

function ratingFromAccuracyCurve(accuracy) {
  const table = [
    [100, 2800],
    [95, 2050],
    [90, 1600],
    [85, 1300],
    [80, 1075],
    [75, 925],
    [70, 650],
    [65, 400],
    [60, 250],
    [55, 175],
    [50, 125],
    [0, 100],
  ];

  const a = clamp(Number(accuracy) || 0, 0, 100);

  for (let i = 0; i < table.length - 1; i++) {
    const [a1, r1] = table[i];
    const [a2, r2] = table[i + 1];

    if (a >= a2) {
      const t = (a - a2) / (a1 - a2);
      return r2 + t * (r1 - r2);
    }
  }

  return 100;
}

function roundEstimatedRating(value) {
  return clamp(Math.round(value / 50) * 50, 100, 3800);
}

function estimatePerformanceRating(
  accuracy,
  baseRating,
  stats,
  result,
  avgLoss
) {
  const actualRating = clamp(Number(baseRating) || 800, 100, 3800);
  const acc = clamp(Number(accuracy) || 0, 0, 100);

  const absolutePerf = ratingFromAccuracyCurve(acc);
  const expectedAcc = getExpectedAccuracy(actualRating);

  const relativeSensitivity =
    actualRating < 700 ? 10 :
    actualRating < 1200 ? 25 :
    actualRating < 2000 ? 22 :
    20;

  const relativePerf =
    actualRating + (acc - expectedAcc) * relativeSensitivity;

  // Low-rated messy games stay mostly accuracy-curve based.
  // Cleaner/higher-rated games get more context from the player's actual rating.
  let perf;

  if (actualRating < 700) {
    perf = absolutePerf * 0.78 + relativePerf * 0.22;
  } else if (actualRating < 1200) {
    perf = absolutePerf * 0.45 + relativePerf * 0.55;
  } else {
    perf = absolutePerf * 0.55 + relativePerf * 0.45;
  }

  const get = (name) => Number(stats?.[name] || 0);

  // Much smaller quality adjustment.
  // Accuracy already contains most of the information.
  const qualityAdjustment =
    get("Brilliant") * 20 +
    get("Great") * 10 +
    get("Best") * 1 -
    get("Inaccuracy") * 1 -
    get("Mistake") * 3 -
    get("Miss") * 5 -
    get("Blunder") * 8;

  let resultAdjustment = 0;
  if (result === "win") resultAdjustment = 0;
  if (result === "loss") resultAdjustment = 0;

  const avgLossPenalty =
    Math.max(0, Number(avgLoss || 0) - 110) * 0.05;

  perf += qualityAdjustment + resultAdjustment - avgLossPenalty;

  // Low-rated game caps.
  // This prevents 500 Elo games from randomly becoming 1200+ performances
  // just because the accuracy was decent.
  if (actualRating < 700) {
    if (acc < 55) perf = Math.min(perf, 500);
    else if (acc < 60) perf = Math.min(perf, 625);
    else if (acc < 65) perf = Math.min(perf, 725);
    else if (acc < 70) perf = Math.min(perf, 825);
    else if (acc < 75) perf = Math.min(perf, 900);
    else if (acc < 80) perf = Math.min(perf, 1000);
    else if (acc < 85) perf = Math.min(perf, 1000);
  }

  return roundEstimatedRating(perf);
}

function computePlayerOverview(color) {
  const qualities = window.moveQualities || [];
  const meta = window.currentGameMeta || {};
  const result =
    color === "white"
      ? meta.whiteResult
      : meta.blackResult;

  const stats = {
    Brilliant: 0,
    Great: 0,
    Book: 0,
    Best: 0,
    Excellent: 0,
    Good: 0,
    Inaccuracy: 0,
    Mistake: 0,
    Miss: 0,
    Blunder: 0,
  };

  let totalAccuracy = 0;
  let countedMoves = 0;
  let totalLoss = 0;

  // NEW: keep only this player's move objects so the messy-game penalty
  // can judge that player's game specifically.
  const playerMoves = [];

  qualities.forEach((q, index) => {
    const moveColor = index % 2 === 0 ? "white" : "black";
    if (moveColor !== color) return;

    playerMoves.push(q);

    const scoringType = q.scoringType || q.type;
    const scoringSeverity = q.scoringSeverity || q.severity;

    const name = qualityDisplayName(q.type, q.severity);
    if (stats[name] !== undefined) stats[name]++;

    const baseRating =
      color === "white" ? meta.whiteRating : meta.blackRating;

    const moveAcc = moveAccuracyFromWinLoss(q, baseRating);

    if (moveAcc !== null) {
      let weight = 1;

      if (scoringType === "book") weight = 0.15;
      else if (q.forced) weight = 0.35;
      else if (scoringType === "best") weight = 1.1;
      else if (scoringType === "brilliant") weight = 1.25;

      if (scoringSeverity === "inaccuracy") weight = 1.2;
      if (scoringSeverity === "mistake") weight = 1.6;
      if (scoringSeverity === "miss") weight = 2.0;
      if (scoringSeverity === "blunder") weight = 3.0;

      totalAccuracy += moveAcc * weight;
      countedMoves += weight;
    }

    totalLoss += overviewLossForRating(q);
  });

  const rawAccuracy = countedMoves
    ? totalAccuracy / countedMoves
    : 100;

  // Display the direct expected-points accuracy. Use the messiness correction
  // only for performance rating so the visible accuracy does not get double-punished.
  const accuracy = clamp(rawAccuracy, 0, 100);
  const ratingAccuracy = applyGameMessinessPenalty(rawAccuracy, playerMoves);

  const baseRating =
    color === "white" ? meta.whiteRating : meta.blackRating;

  const avgLossForRating = totalLoss / Math.max(1, countedMoves);

  const estimatedRating = estimatePerformanceRating(
    ratingAccuracy,
    baseRating,
    stats,
    result,
    avgLossForRating
  );

  return {
    stats,
    avgLoss: countedMoves ? avgLossForRating : 0,
    accuracy,
    estimatedRating,
  };
}

function evalToCp(ev) {
  if (!ev) return 0;
  if (ev.type === "mate") return isMateForWhite(ev) ? 1000 : -1000;
  return Number(ev.value || 0);
}

function renderEvalGraph(result) {
  const evals = result.evaluations || [];
  const width = 420;
  const height = 150;
  const pad = 14;

  if (!evals.length) return "";

  const searchedColor = getSearchedPlayerColor();
  const searchedIsWhite = searchedColor === "white";

  const meta = window.currentGameMeta || {};
  const searchedName =
    searchedColor === "white"
      ? meta.whiteUsername || "You"
      : meta.blackUsername || "You";

  const opponentName =
    searchedColor === "white"
      ? meta.blackUsername || "Opponent"
      : meta.whiteUsername || "Opponent";

  const points = evals.map((ev, i) => {
    const rawCp = evalToCp(ev);
    const perspectiveCp = searchedColor === "black" ? -rawCp : rawCp;
    const cp = clamp(perspectiveCp, -800, 800);

    const x = pad + (i / Math.max(1, evals.length - 1)) * (width - pad * 2);
    const y = pad + ((800 - cp) / 1600) * (height - pad * 2);

    // Keep the chart focused on the searched player's moves.
    const isPlayerMove = i > 0 && ((i - 1) % 2 === 0) === searchedIsWhite;

    return { x, y, cp, i, isPlayerMove };
  });

  const line = points.map(p => `${p.x},${p.y}`).join(" ");

  const dots = points
    .map(p => {
      if (!p.isPlayerMove) return "";

      const q = window.moveQualities?.[p.i - 1];
      const qualityKey = q?.type || q?.severity || "good";
      const style = QUALITY_STYLES[qualityKey] || QUALITY_STYLES.good;
      const fill = style.color;
      const moveSan = result.moves?.[p.i - 1] || "";
      const moveLabel = `${p.i}. ${moveSan} - ${style.label}`;

      return `
        <circle
          class="evalDot"
          cx="${p.x}"
          cy="${p.y}"
          r="3.5"
          fill="${fill}"
          data-ply="${p.i}"
          data-move-label="${moveLabel}"
        >
          <title>${moveLabel}</title>
        </circle>
      `;
    })
    .join("");

  // Invisible backdrop behind the dots: tapping anywhere on the graph jumps to
  // the nearest dot, so a fingertip doesn't need to land on a 3px circle.
  const hitAreas = `<rect class="evalHit" x="0" y="0" width="${width}" height="${height}"></rect>`;

  return `
    <div class="evalGraphWrap" title="Click or tap a dot to jump to that move.">
      <div class="chartLegend">
        <span class="legendTop">↑ ${searchedName} advantage</span>
        <span class="legendBottom">↓ ${opponentName} advantage</span>
      </div>

      <svg class="evalGraph" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <line x1="${pad}" y1="${height / 2}" x2="${width - pad}" y2="${height / 2}"
          stroke="rgba(255,255,255,0.18)" stroke-width="1" />
        <polyline points="${line}" fill="none" stroke="#d9dee8" stroke-width="2" />
        ${hitAreas}
        ${dots}
      </svg>
    </div>
  `;
}

function renderQualityCountButton(qualityKey, side, count) {
  const style = QUALITY_STYLES[qualityKey] || QUALITY_STYLES.good;
  const disabled = count <= 0 ? "disabled" : "";

  return `
    <button
      type="button"
      class="qualityCountButton"
      style="color: ${style.color};"
      data-quality="${qualityKey}"
      data-side="${side}"
      ${disabled}
      title="Jump to first ${style.label} move for ${side}"
      onclick="jumpToQuality('${qualityKey}', '${side}')"
    >
      ${count}
    </button>
  `;
}

function renderQualityRows(stats, side) {
  const order = [
    "Brilliant",
    "Great",
    "Book",
    "Best",
    "Excellent",
    "Good",
    "Inaccuracy",
    "Mistake",
    "Miss",
    "Blunder",
  ];

  return order
    .map(name => {
      const qualityKey = name.toLowerCase();
      const count = stats[name] || 0;

      return `
        <tr class="qualityRow">
          <td class="qualityName">
            ${name}
          </td>
          <td class="qualityCount">
            ${renderQualityCountButton(qualityKey, side, count)}
          </td>
        </tr>
      `;
    })
    .join("");
}

function computeReviewOverviewByColor() {
  // The analysis result must be canonical by board color.
  // Username/search perspective may change the display order, board orientation,
  // and graph labels, but it must never change the actual counts/accuracy/rating.
  const white = computePlayerOverview("white");
  const black = computePlayerOverview("black");

  adjustEstimatedRatingsByResult(white, black);

  return { white, black };
}

window.dumpReviewByColor = function dumpReviewByColor() {
  const overview = computeReviewOverviewByColor();
  const summarize = (side) => ({
    accuracy: Number(overview[side].accuracy.toFixed(1)),
    estimatedRating: overview[side].estimatedRating,
    ...overview[side].stats,
  });

  const rows = {
    white: summarize("white"),
    black: summarize("black"),
  };

  console.table(rows);
  return rows;
};

window.verifyPerspectiveInvariant = function verifyPerspectiveInvariant() {
  const meta = window.currentGameMeta || {};
  const originalUsername = window.currentUsername;
  const originalDisplay = window.currentUsernameDisplay;

  const stableStringify = (value) => JSON.stringify(value, Object.keys(value).sort());
  const normalize = () => {
    const rows = window.dumpReviewByColor();
    return {
      white: stableStringify(rows.white),
      black: stableStringify(rows.black),
    };
  };

  window.currentUsername = meta.whiteUsername || "";
  window.currentUsernameDisplay = meta.whiteUsername || "";
  const fromWhite = normalize();

  window.currentUsername = meta.blackUsername || "";
  window.currentUsernameDisplay = meta.blackUsername || "";
  const fromBlack = normalize();

  window.currentUsername = originalUsername;
  window.currentUsernameDisplay = originalDisplay;

  const invariant =
    fromWhite.white === fromBlack.white &&
    fromWhite.black === fromBlack.black;

  console.log(invariant ? "Perspective invariant: PASS" : "Perspective invariant: FAIL", {
    fromWhite,
    fromBlack,
  });

  return invariant;
};

function renderOverview(result) {
  const container = document.getElementById("overviewContent");
  if (!container) return;

  const overviewByColor = computeReviewOverviewByColor();
  const white = overviewByColor.white;
  const black = overviewByColor.black;
  window.reviewOverviewByColor = overviewByColor;

  const meta = window.currentGameMeta || {};
  const searchedColor = getSearchedPlayerColor();

  const leftColor = searchedColor;
  const rightColor = searchedColor === "white" ? "black" : "white";

  const playerData = {
    white: {
      label: "WHITE",
      name: meta.whiteUsername || "White",
      overview: white,
    },
    black: {
      label: "BLACK",
      name: meta.blackUsername || "Black",
      overview: black,
    },
  };

  const leftPlayer = playerData[leftColor];
  const rightPlayer = playerData[rightColor];

  container.innerHTML = `
    <div class="overviewSection">
      <h3 class="overviewTitle">Evaluation Timeline</h3>
      ${renderEvalGraph(result)}
    </div>
  
    <div class="overviewSection">
      <h3 class="overviewTitle">Accuracy</h3>

      <div class="overviewCards">
        <div class="overviewCard">
          <div class="overviewCardLabel">${leftPlayer.label}</div>
          <div class="overviewCardValue">${leftPlayer.overview.accuracy.toFixed(1)}</div>
          <div class="muted">${leftPlayer.name}</div>
        </div>

        <div class="overviewCard">
          <div class="overviewCardLabel">${rightPlayer.label}</div>
          <div class="overviewCardValue">${rightPlayer.overview.accuracy.toFixed(1)}</div>
          <div class="muted">${rightPlayer.name}</div>
        </div>
      </div>
    </div>

    <div class="overviewSection">
      <h3 class="overviewTitle">Estimated Game Rating</h3>

      <div class="overviewCards">
        <div class="overviewCard">
          <div class="overviewCardLabel">${leftPlayer.label}</div>
          <div class="overviewCardValue">${leftPlayer.overview.estimatedRating}</div>
        </div>

        <div class="overviewCard">
          <div class="overviewCardLabel">${rightPlayer.label}</div>
          <div class="overviewCardValue">${rightPlayer.overview.estimatedRating}</div>
        </div>
      </div>
    </div>

    <div class="overviewSection">
      <h3 class="overviewTitle">Move Quality</h3>

      <div class="overviewCards">
        <div class="overviewCard">
          <div class="overviewCardLabel">${leftPlayer.name}</div>

          <table class="qualityTable">
            ${renderQualityRows(leftPlayer.overview.stats, leftColor)}
          </table>
        </div>

        <div class="overviewCard">
          <div class="overviewCardLabel">${rightPlayer.name}</div>

          <table class="qualityTable">
            ${renderQualityRows(rightPlayer.overview.stats, rightColor)}
          </table>
        </div>
      </div>
    </div>
  `;

  container.querySelectorAll(".evalHit").forEach(hit => {
    hit.addEventListener("click", event => {
      const svg = hit.ownerSVGElement;
      const box = svg.getBoundingClientRect();
      const viewWidth = svg.viewBox.baseVal.width || box.width;
      const x = ((event.clientX - box.left) / box.width) * viewWidth;

      let nearest = null;
      let nearestDistance = Infinity;

      svg.querySelectorAll(".evalDot").forEach(dot => {
        const distance = Math.abs(Number(dot.getAttribute("cx")) - x);
        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearest = dot;
        }
      });

      if (nearest) jumpToMoveIndex(Number(nearest.dataset.ply) - 1);
    });
  });

  container.querySelectorAll(".evalDot").forEach(dot => {
    dot.style.cursor = "pointer";

    dot.addEventListener("mouseenter", () => {
      dot.setAttribute("r", "6");
    });

    dot.addEventListener("mouseleave", () => {
      dot.setAttribute("r", "3.5");
    });

    dot.addEventListener("click", () => {
      const ply = Number(dot.dataset.ply);
      jumpToMoveIndex(ply - 1);
    });
  });
}

function getMoveQualityIcon(q) {
  if (!q) return "";

  if (q.forcedMate) return " →→";
  if (q.forced) return " →";
  if (q.type === "brilliant") return " !!";
  if (q.type === "great") return " !";
  if (q.type === "book") return " 📖";
  if (q.type === "miss") return " ❌";
  if (q.severity === "blunder") return " ??";
  if (q.severity === "mistake") return " ?";
  if (q.severity === "inaccuracy") return " ?!";

  return "";
}

function renderMoveTextWithQuality(moveIndex, san) {
  if (!san) return "";

  const q = window.moveQualities?.[moveIndex];
  const qualityKey = q?.type || q?.severity || "good";
  const style = QUALITY_STYLES[qualityKey] || QUALITY_STYLES.good;
  const icon = getMoveQualityIcon(q);

  return `
    <span
      class="moveQualityText"
      style="color: ${style.color};"
      title="${style.label}"
    >
      ${san}${icon}
    </span>
  `;
}

// --- UI Rendering ---
window.initAnalysisUI = async function(result) {
  if (
    !result ||
    !Array.isArray(result.fens) ||
    result.fens.length === 0 ||
    !Array.isArray(result.moves)
  ) {
    console.error("initAnalysisUI: invalid result", result);
    alert("Analysis data was invalid.");
    return;
  }

  normalizeTerminalMateEvals(result);

  // Wire tab clicks once
  if (!window.__tabsInitialized) {
    const tabOverview = document.getElementById("tabOverview");
    const tabMoves = document.getElementById("tabMoves");
    const tabInfo = document.getElementById("tabInfo");

    if (tabOverview) tabOverview.onclick = () => setActiveTab("overview");
    if (tabMoves) tabMoves.onclick = () => setActiveTab("moves");
    if (tabInfo) tabInfo.onclick = () => setActiveTab("info");

    const viewGameBtn = document.getElementById("viewGameBtn");
    if (viewGameBtn) viewGameBtn.onclick = () => setActiveTab("moves");

    const overviewBtn = document.getElementById("overviewBtn");
    if (overviewBtn) overviewBtn.onclick = () => setActiveTab("overview");

    const backToGamesBtn = document.getElementById("backToGamesBtn");
    if (backToGamesBtn) backToGamesBtn.onclick = exitAnalysisToGames;

    const phoneBackBtn = document.getElementById("phoneBackBtn");
    if (phoneBackBtn) phoneBackBtn.onclick = exitAnalysisToGames;

    const analysisBackBtn = document.getElementById("analysisBackBtn");
    if (analysisBackBtn) analysisBackBtn.onclick = exitAnalysisToGames;

    window.__tabsInitialized = true;
  }

  // Make analysis layout visible BEFORE creating/resizing board
  showAnalysisMode();
  renderBoardPlayers();
  setActiveTab("moves");

  window.analysisResult = result;
  window.currentMoveIndex = 0;
  window.maxIndex = result.fens.length - 1;

  // Create board only once
  if (!window.boardApi) {
    window.boardApi = Chessboard("board", {
      position: "start",
      pieceTheme: "/img/chesspieces/wikipedia/{piece}.png",
      draggable: false
    });
  }

  const orientation = getSearchedPlayerColor();
  window.boardApi.orientation(orientation);
  window.getSearchedPlayerColor = getSearchedPlayerColor;

  // Put board at starting FEN, then force resize after layout paints
  window.boardApi.position(result.fens[0], false);
  resizeBoardAfterLayout();

  // Fetch opening/book data in parallel
  const bookMap = {};
  const openingNameMap = {};

  const openingPromises = result.fens.slice(0, 36).map(fen => {
    const key = fenPositionKey(fen);

    return fetch(`/api/opening?fen=${encodeURIComponent(fen)}`)
      .then(r => r.json())
      .then(resp => {
        bookMap[key] = (resp.moves || [])
          .map(move => {
            if (typeof move === "string") return move;
            return move.uci || move.move || null;
          })
          .filter(Boolean);

        openingNameMap[key] =
          resp.opening_name ||
          resp.name ||
          null;
      })
      .catch(() => {
        bookMap[key] = [];
        openingNameMap[key] = null;
      });
  });

  await Promise.all(openingPromises);

  // Convert SAN moves to UCI moves
  const uciMoves = [];
  const temp = new Chess();

  result.moves.forEach(m => {
    const mv = temp.move(m, { sloppy: true });
    uciMoves.push(mv ? mv.from + mv.to + (mv.promotion || "") : null);
  });

  window.moveQualities = computeMoveQualities(
    result.evaluations,
    result.moves,
    uciMoves,
    result.fens,
    bookMap,
    openingNameMap
  );

  window.openingNameMap = openingNameMap;

  renderOverview(result);
  renderMoveTable(result);
  renderMoveRibbon(result);
  createControlButtons();

  window.boardApi.position(result.fens[0], false);
  updateUI();
  resizeBoardAfterLayout();

  // On phones, open with the game summary on top of the board;
  // "View game" then reveals the board and step controls.
  if (isPhoneLayout()) setActiveTab("overview");
};

function renderMoveTable(result) {
  const list = document.getElementById("moveList");
  if (!list) return;

  list.innerHTML = "";

  const table = document.createElement("table");
  table.className = "move-table";

  for (let i = 0; i < result.moves.length; i += 2) {
    const moveNumber = i / 2 + 1;

    const whiteMove = result.moves[i];
    const blackMove = result.moves[i + 1];

    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td class="move-num">${moveNumber}.</td>

      <td class="move-cell" data-ply="${i}">
        ${renderMoveTextWithQuality(i, whiteMove)}
      </td>

      <td class="move-cell" ${blackMove ? `data-ply="${i + 1}"` : ""}>
        ${blackMove ? renderMoveTextWithQuality(i + 1, blackMove) : ""}
      </td>
    `;

    table.appendChild(tr);
  }

  list.appendChild(table);

  list.onclick = (e) => {
    const cell = e.target.closest(".move-cell");

    if (!cell || cell.dataset.ply === undefined) return;

    jumpToMoveIndex(Number(cell.dataset.ply));
  };
}

/* ---------------------------
   Phone game view: verdict bubble + move strip
---------------------------- */

const QUALITY_SYMBOLS = {
  brilliant: "!!",
  great: "!",
  book: "📖",
  best: "★",
  excellent: "👍",
  good: "✓",
  inaccuracy: "?!",
  mistake: "?",
  miss: "✕",
  blunder: "??",
};

// Eval from White's point of view, like "+0.32", "-1.50" or "#3"
function formatEvalChip(ev) {
  if (!ev) return "";

  if (ev.type === "mate") {
    if (ev.value === 0) return "#";
    return `${isMateForWhite(ev) ? "" : "-"}#${Math.abs(ev.value)}`;
  }

  const pawns = Number(ev.value || 0) / 100;
  return `${pawns > 0 ? "+" : ""}${pawns.toFixed(2)}`;
}


// Optional Stockfish continuation explorer. It never mutates the game's
// selected ply, classifications, or original FENs.
let explanationSession = null;

function htmlEscape(value) {
  return String(value ?? '').replace(/[&<>"']/g, ch =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[ch]);
}

function getExplainCandidate(ply) {
  const result = window.analysisResult;
  const q = window.moveQualities?.[ply];
  const startingFen = result?.fens?.[ply + 1];
  const rawPv = enginePvMoves(result?.evaluations?.[ply + 1]);
  if (!q || !startingFen || rawPv.length < 2) return null;

  const board = new Chess(startingFen);
  const steps = [];
  let materialScore = 0;
  let tactical = false;
  // Up to ten full moves. Stop at the first stable tactical resolution when
  // possible, rather than arbitrarily showing exactly five plies.
  for (const uci of rawPv.slice(0, 20)) {
    const before = board.fen();
    const played = getLegalMoveFromUci(board, uci);
    if (!played) break;
    const capture = played.captured ? pieceValue(played.captured) : 0;
    const mover = played.color === 'w' ? 1 : -1;
    materialScore += capture * mover;
    if (played.captured && capture >= 3 || /[+#]/.test(played.san || '') ||
        played.promotion) tactical = true;
    steps.push({before, after: board.fen(), move: played, uci});
    if (played.san?.includes('#')) break;
    // After at least 4 plies, stop following a resolved tactical exchange.
    if (steps.length >= 4 && capture >= 3 &&
        (steps.length === rawPv.length || !rawPv[steps.length])) break;
  }
  if (steps.length < 2) return null;
  const isError = BAD_MOVE_TYPES.has(q.type);
  const hasDemonstrableIdea = tactical || q.idea?.arrows?.length > 0 ||
    q.badMoveLesson?.arrows?.length > 0;
  if (!isError && !hasDemonstrableIdea) return null;
  return { ply, startingFen, steps, step: 0, materialScore };
}

function describeExplanationStep(item, upcoming) {
  const move = item.move;
  const piece = IDEA_PIECE_NAMES[move.piece] || 'piece';
  const opponent = move.color === 'w' ? 'Black' : 'White';
  const board = new Chess(item.after);
  const moverPiece = board.get(move.to);
  if (move.captured) {
    const victim = IDEA_PIECE_NAMES[move.captured] || 'piece';
    const recapture = upcoming?.move?.captured && upcoming.move.to === move.to;
    return `The ${piece} captures the ${victim} on ${move.to}. ` +
      (recapture ? `${opponent} can recapture on the same square, so this is an exchange rather than a free piece.` :
        `This changes the material balance and may create additional threats.`);
  }
  if (move.san?.includes('#')) return `The ${piece} delivers checkmate, ending the game.`;
  if (move.san?.includes('+')) return `The ${piece} gives check. The opponent must respond before pursuing any other plan.`;
  if (/^O-O/.test(move.san || '')) return 'Castling moves the king toward safety and activates the rook.';
  if (moverPiece) {
    const valuable = squaresControlledBy(board, move.to, moverPiece)
      .map(square => ({ square, target: board.get(square) }))
      .filter(x => x.target && x.target.color !== move.color &&
        pieceValue(x.target.type) >= 3)
      .sort((a,b) => pieceValue(b.target.type)-pieceValue(a.target.type));
    if (valuable.length) {
      const threat = valuable[0];
      const target = IDEA_PIECE_NAMES[threat.target.type] || 'piece';
      return `The ${piece} develops to ${move.to} and attacks the opposing ${target} on ${threat.square}. The opponent must consider this threat.`;
    }
  }
  if (move.piece === 'p') return `The pawn advances to ${move.to}, changing the pawn structure and controlling new squares.`;
  if (move.piece === 'k') return `The king steps to ${move.to}, responding to the position without conceding an immediate material capture.`;
  return `The ${piece} moves to ${move.to}. Watch how the next moves change the threats and piece coordination.`;
}

function explanationSummary(session) {
  const baseline = new Chess(session.startingFen);
  const last = new Chess(session.steps[session.steps.length - 1].after);
  const value = board => {
    let sum = 0;
    for (const rank of board.fen().split(' ')[0].split('/')) {
      for (const c of rank) {
        if (/[a-z]/i.test(c)) sum += pieceValue(c.toLowerCase()) * (c === c.toUpperCase() ? 1 : -1);
      }
    }
    return sum;
  };
  const diff = value(last) - value(baseline);
  const amount = Math.abs(diff);
  if (amount >= 1) return `By the end of this sample line, ${diff > 0 ? 'White' : 'Black'} has gained about ${amount} point${amount === 1 ? '' : 's'} of material relative to the starting position. This is an illustrative engine continuation, not a guarantee that the opponent must play this way.`;
  return `The sample line finishes without a net material gain. Its value may be positional or depend on further moves; the engine line is not proof of a forced win.`;
}

function displayExplanation() {
  const session = explanationSession;
  if (!session) return;
  const item = session.step ? session.steps[session.step - 1] : null;
  const upcoming = session.steps[session.step];
  const title = item ? `Explaining ${htmlEscape(item.move.san)}` : 'Explore the Stockfish continuation';
  const text = item ? describeExplanationStep(item, upcoming) :
    'Follow the engine’s legal moves to see the idea. Use Next and Previous, then Got it to return to the actual game.';
  const ending = session.step === session.steps.length ? ` ${explanationSummary(session)}` : '';
  const chips = [`<button type="button" class="explainChip ${session.step === 0 ? 'active' : ''}" data-explain-step="0">Start</button>`];
  for (let i = 0; i < session.steps.length; i++) {
    const item = session.steps[i];
    const number = Number(item.before.split(/\s+/)[5] || 1);
    const prefix = `${number}${item.move.color === 'w' ? '.' : '...'}`;
    chips.push(`<button type="button" class="explainChip ${session.step === i + 1 ? 'active' : ''}" data-explain-step="${i + 1}">${prefix} ${htmlEscape(item.move.san)}</button>`);
  }
  const markup = `<div class="coachHead"><span class="coachIcon" style="background:#ffbb4c;color:#151515">✦</span>
    <span class="coachTitle">${title}</span><span class="coachEval">${session.step}/${session.steps.length}</span></div>
    <p class="coachText">${htmlEscape(text + ending)}</p><div class="explainChips">${chips.join('')}</div>`;
  for (const id of ['coachBubble','panelCoachBubble']) {
    const bubble = document.getElementById(id);
    if (!bubble) continue;
    bubble.innerHTML = markup;
    bubble.querySelectorAll('[data-explain-step]').forEach(btn => {
      btn.onclick = () => setExplanationStep(Number(btn.dataset.explainStep));
    });
  }
  const fen = item?.after || session.startingFen;
  window.boardApi?.position(fen, false);
  clearArrows();
  if (item) drawArrow(item.move.from, item.move.to, '#f4b84e', {clear:false});
  const controls = document.getElementById('analysisControls');
  if (controls) {
    controls.classList.add('explainControls');
    controls.innerHTML = `<button type="button" class="explainPrev" ${session.step === 0 ? 'disabled' : ''}>‹ Previous</button>
      <button type="button" class="explainNext" ${session.step === session.steps.length ? 'disabled' : ''}>Next ›</button>
      <button type="button" class="explainGotIt">✓ Got it</button>`;
    controls.querySelector('.explainPrev').onclick = () => setExplanationStep(session.step - 1);
    controls.querySelector('.explainNext').onclick = () => setExplanationStep(session.step + 1);
    controls.querySelector('.explainGotIt').onclick = finishExplanation;
  }
}

function setExplanationStep(step) {
  if (!explanationSession) return;
  explanationSession.step = Math.max(0, Math.min(explanationSession.steps.length, step));
  displayExplanation();
}
function startExplanation() {
  const candidate = getExplainCandidate(window.currentMoveIndex - 1);
  if (!candidate) return;
  explanationSession = candidate;
  displayExplanation();
}
function finishExplanation() {
  if (!explanationSession) return;
  explanationSession = null;
  const controls = document.getElementById('analysisControls');
  controls?.classList.remove('explainControls');
  createControlButtons();
  const result = window.analysisResult;
  if (result?.fens) window.boardApi?.position(result.fens[window.currentMoveIndex], false);
  updateUI();
}

function updateCoachBubble(q) {
  const bubbles = ["coachBubble", "panelCoachBubble"]
    .map(id => document.getElementById(id))
    .filter(Boolean);
  if (!bubbles.length) return;

  const ev = window.analysisResult?.evaluations?.[window.currentMoveIndex];

  let key = null;
  let title = "Game review";
  let text = "Step through the game with the buttons below.";

  if (q) {
    key = q.type || q.severity || "good";
    const insight = q.insight || {
      title: "Solid move",
      text: "A reasonable move.",
    };
    title = insight.title;
    text = insight.text;
  }

  const style = key ? QUALITY_STYLES[key] || QUALITY_STYLES.good : null;
  const symbol = key ? QUALITY_SYMBOLS[key] || "✓" : "♟";

  const markup = `
    <div class="coachHead">
      <span
        class="coachIcon"
        style="background: ${style ? style.color : "var(--accent)"};"
      >${symbol}</span>
      <span class="coachTitle">${title}</span>
      <span class="coachEval">${formatEvalChip(ev)}</span>
    </div>
    <p class="coachText">${text}</p>
  `;

  const candidate = q && getExplainCandidate(window.currentMoveIndex - 1);
  const action = candidate ? '<button type="button" class="explainStart">✦ Explain this line</button>' : '';
  bubbles.forEach(bubble => {
    bubble.innerHTML = markup + action;
    const button = bubble.querySelector('.explainStart');
    if (button) button.onclick = startExplanation;
  });
}

function renderMoveRibbon(result) {
  const ribbon = document.getElementById("moveRibbon");
  if (!ribbon) return;

  const parts = [];

  result.moves.forEach((san, i) => {
    if (i % 2 === 0) {
      parts.push(`<span class="ribbonNum">${i / 2 + 1}.</span>`);
    }

    parts.push(
      `<button type="button" class="ribbonMove" data-ply="${i}">${renderMoveTextWithQuality(i, san)}</button>`
    );
  });

  ribbon.innerHTML = parts.join("");

  ribbon.onclick = (e) => {
    const btn = e.target.closest(".ribbonMove");
    if (!btn) return;
    jumpToMoveIndex(Number(btn.dataset.ply));
  };
}

function updateMoveRibbon() {
  const ribbon = document.getElementById("moveRibbon");
  if (!ribbon) return;

  const ply = window.currentMoveIndex - 1;

  ribbon.querySelectorAll(".ribbonMove").forEach((btn) => {
    btn.classList.toggle("active-move", Number(btn.dataset.ply) === ply);
  });

  // Hidden on desktop / while the summary card is open
  if (ribbon.offsetParent === null) return;

  const active = ribbon.querySelector(".ribbonMove.active-move");
  const left = active
    ? active.offsetLeft - (ribbon.clientWidth - active.offsetWidth) / 2
    : 0;

  // Scroll the strip itself; scrollIntoView could scroll the whole page
  ribbon.scrollTo({ left: Math.max(0, left), behavior: "smooth" });
}

function updateActiveMoveHighlight() {
  const ply = window.currentMoveIndex - 1;
  document.querySelectorAll(".move-cell").forEach(el => {
    el.classList.toggle("active-move", Number(el.dataset.ply) === ply);
  });
  // Scroll active cell into view
  const active = document.querySelector(`.move-cell[data-ply="${ply}"]`);
  if (active) active.scrollIntoView({ block: "nearest" });
}

function updateEvalBar() {
  const ev = window.analysisResult?.evaluations?.[window.currentMoveIndex];
  const whiteBar = document.getElementById("evalBarWhite");
  const blackBar = document.getElementById("evalBarBlack");
  const label = document.getElementById("evalBarLabel");

  if (!ev || !whiteBar || !blackBar) return;

  let cp;

  if (ev.type === "mate") {
    cp = isMateForWhite(ev) ? 1000 : -1000;
  } else {
    cp = Number(ev.value || 0);
  }

  const clamped = Math.max(-800, Math.min(800, cp));

  // Positive cp = white better, negative cp = black better
  const whitePercent = Math.max(5, Math.min(95, 50 + (clamped / 800) * 50));
  const blackPercent = 100 - whitePercent;

  const orientation =
    window.boardApi && typeof window.boardApi.orientation === "function"
      ? window.boardApi.orientation()
      : "white";

  if (orientation === "black") {
    // Black is at bottom
    blackBar.style.top = "auto";
    blackBar.style.bottom = "0";
    blackBar.style.height = `${blackPercent}%`;

    whiteBar.style.top = "0";
    whiteBar.style.bottom = "auto";
    whiteBar.style.height = `${whitePercent}%`;
  } else {
    // White is at bottom
    whiteBar.style.top = "auto";
    whiteBar.style.bottom = "0";
    whiteBar.style.height = `${whitePercent}%`;

    blackBar.style.top = "0";
    blackBar.style.bottom = "auto";
    blackBar.style.height = `${blackPercent}%`;
  }

  if (label) {
    label.textContent =
      ev.type === "mate" ? formatMateLabel(ev) : (cp / 100).toFixed(1);
  }
}

function updateUI() {
  if (explanationSession) { displayExplanation(); return; }
  const idx = window.currentMoveIndex - 1;
  const q = window.moveQualities?.[idx];

  // currentEvalText lives in the Info tab — guard against it being absent
  const evalEl = document.getElementById("currentEvalText");
  if (evalEl) {
    const ev = window.analysisResult?.evaluations?.[window.currentMoveIndex];
    if (ev) {
      evalEl.innerHTML = `<strong>Eval:</strong> ${ev.type === "mate" ? formatMateLabel(ev) : (ev.value / 100).toFixed(1)}`;
    }
  }

  updateCoachBubble(q);
  updateMoveRibbon();

  updateActiveMoveHighlight();
  updateEvalBar();
  drawBestMoveArrow();
  if (q?.uci) {
    drawMoveQualityBadge(q.uci, q);
  } else {
    clearMoveBadges();
  }
}

function createControlButtons() {
  const ctrls = document.getElementById("analysisControls");
  if (!ctrls) return;
  ctrls.classList.remove('explainControls');
  ctrls.innerHTML = "";

  const b = (t, f) => {
    const btn = document.createElement("button");
    btn.innerText = t;
    btn.onclick = f;
    ctrls.appendChild(btn);
  };

  b("<<", () => {
    window.currentMoveIndex = 0;
    window.boardApi.position(window.analysisResult.fens[0], true);
    updateUI();

    requestAnimationFrame(() => {
      resetMoveListScroll();
    });
  });

  b("<", () => {
    if (window.currentMoveIndex > 0) {
      window.currentMoveIndex--;
      window.boardApi.position(window.analysisResult.fens[window.currentMoveIndex], true);
      updateUI();
    }
  });

  b(">", () => {
    if (window.currentMoveIndex < window.maxIndex) {
      window.currentMoveIndex++;
      window.boardApi.position(window.analysisResult.fens[window.currentMoveIndex], true);
      updateUI();
    }
  });

  b(">>", () => {
    window.currentMoveIndex = window.maxIndex;
    window.boardApi.position(window.analysisResult.fens[window.maxIndex], true);
    updateUI();
  });
}

function resetMoveListScroll() {
  const moveList = document.getElementById("moveList");
  if (!moveList) return;

  // Scroll the move list itself.
  moveList.scrollTop = 0;

  // Also scroll any parent container that might be the actual scrolling element.
  let parent = moveList.parentElement;

  while (parent) {
    if (parent.scrollHeight > parent.clientHeight) {
      parent.scrollTop = 0;
    }

    parent = parent.parentElement;
  }
}





window.reconcileRepeatedMoveQualities = reconcileRepeatedMoveQualities;
window.getExplainCandidate = getExplainCandidate;
