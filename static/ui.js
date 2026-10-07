/*
  ui.js
  Contextual move-quality tuning: stricter opening book, winning-side forgiveness, and competitive/high-rated strictness.

  ui.js
  -----
  Now with Opening Book support and Expected Points classification.
*/


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
function setActiveTab(tabName) {
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
          window.analysisResult.fens[window.currentMoveIndex || 0],
          false
        );
      }
    });
  });
}

window.addEventListener("resize", resizeBoardAfterLayout);

function clearAnalysisState() {
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

  const insightsContent = document.getElementById("insightsContent");
  if (insightsContent) {
    insightsContent.innerHTML = `
      <div class="emptyState compact">
        <div class="emptyStateTitle">Insights</div>
        <div class="emptyStateText">Analysis will appear here for each move.</div>
      </div>
    `;
  }

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

function drawArrow(fromSq, toSq, color = "#ffaa44") {
  const svg = initArrowOverlay();
  if (!svg) return;

  clearArrows();

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
  line.setAttribute("opacity", "0.82");

  svg.appendChild(line);
}

function drawBestMoveArrow() {
  const selectedPly = window.currentMoveIndex - 1;

  if (selectedPly < 0 || !window.moveQualities?.[selectedPly]) {
    return clearArrows();
  }

  const q = window.moveQualities[selectedPly];
  const beforeEval = window.analysisResult.evaluations[selectedPly];
  const afterEval = window.analysisResult.evaluations[window.currentMoveIndex];

  clearArrows();

  // No auto arrows for clean moves.
  if (
    q.type === "best" ||
    q.type === "book" ||
    q.type === "brilliant" ||
    q.type === "great"
  ) {
    return;
  }

  // Bad moves: show the move that should have been played.
  if (
    q.severity === "blunder" ||
    q.severity === "mistake" ||
    q.severity === "inaccuracy" ||
    q.severity === "miss"
  ) {
    const betterMove = q.engineBest || beforeEval?.best_move;

    if (betterMove && betterMove.length >= 4) {
      const color =
        q.severity === "blunder" || q.severity === "mistake"
          ? "#ff4d5e"
          : "#ffb84d";

      drawArrow(betterMove.slice(0, 2), betterMove.slice(2, 4), color);
    }

    return;
  }

  // For good but not best moves, optionally show the best alternative.
  if (q.type === "good") {
    const bestMove = beforeEval?.best_move;

    if (bestMove && bestMove.length >= 4 && bestMove !== q.uci) {
      drawArrow(bestMove.slice(0, 2), bestMove.slice(2, 4), "#6aa0ff");
    }
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

  qualities.forEach((q, i) => {
    if (!q) return;

    q.insight = generateMoveInsight({
      moveSan: moves[i],
      quality: q.type,
      severity: q.severity,
      evalLoss: q.evalLoss,
      evalGain: q.evalGain,
      engineBest: q.engineBest,
    });
  });

  window.moveQualities = qualities;
  window.moveContexts = qualities;

  return qualities;
}

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

  return `
    <div class="evalGraphWrap" title="Hover to enlarge. Click a dot to jump to that move.">
      <div class="chartLegend">
        <span class="legendTop">↑ ${searchedName} advantage</span>
        <span class="legendBottom">↓ ${opponentName} advantage</span>
      </div>

      <svg class="evalGraph" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none">
        <line x1="${pad}" y1="${height / 2}" x2="${width - pad}" y2="${height / 2}"
          stroke="rgba(255,255,255,0.18)" stroke-width="1" />
        <polyline points="${line}" fill="none" stroke="#d9dee8" stroke-width="2" />
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

function renderOverview(result) {
  const container = document.getElementById("overviewContent");
  if (!container) return;

  const white = computePlayerOverview("white");
  const black = computePlayerOverview("black");
  adjustEstimatedRatingsByResult(white, black);

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
  createControlButtons();

  window.boardApi.position(result.fens[0], false);
  updateUI();
  resizeBoardAfterLayout();
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
  const idx = window.currentMoveIndex - 1;
  const q = window.moveQualities?.[idx];
  const insightsDiv = document.getElementById("insightsContent");

  if (insightsDiv && q) {
  const insight = q.insight || {
    title: "Solid move",
    text: "A reasonable move.",
  };

  insightsDiv.innerHTML = `
    <div class="insight-text">
      <strong>${insight.title}</strong>
      <p>${insight.text}</p>
    </div>
  `;
}

  // currentEvalText lives in the Info tab — guard against it being absent
  const evalEl = document.getElementById("currentEvalText");
  if (evalEl) {
    const ev = window.analysisResult?.evaluations?.[window.currentMoveIndex];
    if (ev) {
      evalEl.innerHTML = `<strong>Eval:</strong> ${ev.type === "mate" ? formatMateLabel(ev) : (ev.value / 100).toFixed(1)}`;
    }
  }

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