/*
  ui.js
  Stable move-quality rollback: removes the aggressive rating-gap label modifier while keeping UI colour/click features.

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

  if (!whiteWon && !blackWon) return;

  const winner = whiteWon ? whiteOverview : blackOverview;
  const loser = whiteWon ? blackOverview : whiteOverview;

  const accuracyGap = winner.accuracy - loser.accuracy;

  // If winner has similar or better accuracy, winner should clearly rate higher.
  if (accuracyGap > -3 && winner.estimatedRating <= loser.estimatedRating) {
    const midpoint = Math.round(
      (winner.estimatedRating + loser.estimatedRating) / 2
    );

    winner.estimatedRating = midpoint + 75;
    loser.estimatedRating = midpoint - 75;
  }

  // If loser had much better accuracy, allow loser to stay higher,
  // but not by a huge amount.
  if (accuracyGap <= -3 && loser.estimatedRating - winner.estimatedRating > 120) {
    loser.estimatedRating = winner.estimatedRating + 120;
  }

  winner.estimatedRating = clamp(winner.estimatedRating, 100, 3800);
  loser.estimatedRating = clamp(loser.estimatedRating, 100, 3800);
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

  const isNearBest =
    evalLoss <= 45 &&
    epLoss <= 0.045;

  if (!isNearBest) return false;

  const routineRecapture = isLikelyRoutineRecapture(moves, index);
  if (routineRecapture) return false;

  const actualSacrifice = isActualSacrifice(q);

  const savesBadPosition =
    beforeCp < -80 &&
    afterCp > beforeCp + 120;

  const findsBigOnlyMove =
    topMoveGap >= 120;

  const improvesClearly =
    afterCp > beforeCp + 80;

  const alreadyCompletelyWinning =
    beforeCp > 650 &&
    afterCp > 650;

  if (alreadyCompletelyWinning && !actualSacrifice) return false;

  // Captures are common. Do not auto-upgrade normal captures just because
  // they are engine best. They need extra context.
  if (isCaptureSan(san)) {
    return (
      actualSacrifice ||
      savesBadPosition ||
      improvesClearly ||
      topMoveGap >= 180
    );
  }

  return (
    savesBadPosition ||
    findsBigOnlyMove ||
    improvesClearly ||
    q?.likelyGreatMove === true
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


function computeMoveQualities(evals, moves, uciMoves, fens, bookMap, openingNameMap = {}) {
  const qualities = [];
  const meta = window.currentGameMeta || {};

  const clampNumber = (value, min, max) => {
    return Math.max(min, Math.min(max, value));
  };

  const getCp = (e) => {
    if (!e) return 0;

    if (e.type === "mate") {
      return e.value > 0 ? 10000 : -10000;
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

    const evalLoss = Math.max(0, beforeCpPlayer - afterCpPlayer);
    const evalGain = Math.max(0, afterCpPlayer - beforeCpPlayer);

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

    const openingBookChainActive =
      moveNumber <= 5 &&
      (
        isListedBookMove ||
        isKnownOpeningPosition ||
        previousPlyWasBook ||
        previousOwnMoveWasBook ||
        moveNumber <= 2
      );

    const isLowRiskOpeningMove =
      evalLoss <= 100 &&
      epLoss <= 0.055 &&
      (
        isTopMove ||
        isNearTopMove ||
        isKnownOpeningPosition ||
        openingBookChainActive
      );

    const isEarlyKnownOpeningMove =
      moveNumber <= 5 &&
      openingBookChainActive &&
      isLowRiskOpeningMove;

    const isBook =
      moveNumber <= 12 &&
      (
        isListedBookMove ||
        isEarlyKnownOpeningMove
      );

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
        return line.value > 0
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

    else if (
      isNearTopMove &&
      epLoss <= 0.025 &&
      evalLoss <= 80
    ) {
      type = likelyGreatMove ? "great" : "excellent";
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
      const walksIntoMate =
        !alreadyCompletelyLost &&
        afterMateAgainstPlayer;

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
        (
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

// This is now much stricter.
// It only forgives genuinely harmless quiet moves.
// The old version was letting 0.06–0.07 EP losses become Good too often.
const softErrorShouldBeForgiven =
  quietMove &&
  stillPlayableAfter &&
  epLoss < 0.055 &&
  evalLoss < 95 &&
  topMoveGap <= 35 &&
  !beforeWinning &&
  !createsBigSwing;

// This is the important new middle zone.
// These are not always mistakes, but they should not be called Good either.
const quietMoveHasRealCost =
  quietMove &&
  stillPlayableAfter &&
  (
    epLoss >= 0.058 ||
    evalLoss >= 100 ||
    topMoveGap >= 45 ||
    afterCpPlayer <= -300
  );

// Good should be for small, playable losses.
// It should not absorb every quiet move.
const isGoodButNotBest =
  !isBlunder &&
  !isMissOpportunity &&
  !isMistake &&
  !quietMoveHasRealCost &&
  afterCpPlayer > -650 &&
  (
    (
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
  Math.max(thresholds.inaccuracy * 0.95, 0.055);

const inaccuracyHasConsequence =
  quietMoveHasRealCost ||
  topMoveGap >= 55 ||
  evalLoss >= 100 ||
  afterCpPlayer <= -300 ||
  (
    beforeClearlyBetter &&
    afterCpPlayer < beforeCpPlayer - 80
  );

const isInaccuracy =
  !isBlunder &&
  !isMissOpportunity &&
  !isMistake &&
  !isGoodButNotBest &&
  (
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

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function qualityDisplayName(type, severity) {
  if (type === "brilliant") return "Brilliant";
  if (type === "great") return "Great";
  if (type === "best") return "Best";
  if (type === "excellent") return "Excellent";
  if (type === "book") return "Book";
  if (type === "good") return "Good";
  if (severity === "inaccuracy") return "Inaccuracy";
  if (severity === "mistake") return "Mistake";
  if (severity === "miss") return "Miss";
  if (severity === "blunder") return "Blunder";
  return "Good";
}

function moveAccuracyFromWinLoss(q, baseRating = 1000) {
  if (!q) return 100;
  if (q.type === "book") return null;

  if (q.type === "brilliant") return 100;
  if (q.type === "great") return 98;
  if (q.type === "best") return 96;
  if (q.type === "excellent") return 91;

  const wl = Math.max(0, Number(q.winLoss || 0));
  const loss = Math.max(0, Number(q.evalLoss || 0));

  // Win-probability penalty
  const winLossAccuracy = 100 * Math.exp(-7.5 * wl);

  // Centipawn-loss penalty
  const cpAccuracy = 100 * Math.exp(-loss / 260);

  // Use the harsher one so already-lost positions don't get over-rewarded.
  let accuracy = Math.min(winLossAccuracy, cpAccuracy);

  if (q.severity === "inaccuracy") accuracy *= 0.95;
  if (q.severity === "mistake") accuracy *= 0.88;
  if (q.severity === "miss") accuracy *= 0.82;
  if (q.severity === "blunder") accuracy *= 0.65;

  return clamp(accuracy, 0, 100);
}

// Returns the accuracy level a player at `rating` is expected to achieve
// under depth-12 Stockfish analysis. Higher-rated players are held to a
// higher bar, so the same raw accuracy score means different things at
// different ELO levels.
function getExpectedAccuracy(rating) {
  const table = [
    [3400, 93],
    [3000, 90],
    [2600, 87],
    [2200, 83],
    [1800, 78],
    [1400, 72],
    [1200, 67],
    [800,  59],
    [400,  50],
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

function getPerformanceProfile(rating) {
  if (rating < 1200) {
    return {
      expectedOffset: 0,
      sensitivity: 10,
      maxGain: 90,
      maxLoss: 180,
      mistakeScale: 0.55,
      winBonus: 70,
      lossPenalty: 90,
    };
  }

  if (rating < 2200) {
    return {
      expectedOffset: 0,
      sensitivity: 15,
      maxGain: 180,
      maxLoss: 240,
      mistakeScale: 0.85,
      winBonus: 90,
      lossPenalty: 120,
    };
  }

  return {
    expectedOffset: 0,
    sensitivity: 22,
    maxGain: 260,
    maxLoss: 420,
    mistakeScale: 1.15,
    winBonus: 110,
    lossPenalty: 180,
  };
}

function estimatePerformanceRating(
  accuracy,
  baseRating,
  stats,
  result,
  avgLoss
) {
  const rating = clamp(Number(baseRating) || 1200, 400, 3800);
  const profile = getPerformanceProfile(rating);

  const expectedAcc = getExpectedAccuracy(rating) + profile.expectedOffset;
  const accDelta = accuracy - expectedAcc;

  const accAdjustment = clamp(
    accDelta * profile.sensitivity,
    -profile.maxLoss,
    profile.maxGain
  );

  const mistakePenalty =
    (
      stats.Blunder * 90 +
      stats.Mistake * 40 +
      stats.Miss * 32 +
      stats.Inaccuracy * 12
    ) * profile.mistakeScale;

  const highlightBonus =
    (
      stats.Great * 12 +
      stats.Brilliant * 35
    ) * profile.mistakeScale;

  let resultBonus = 0;
  if (result === "win") resultBonus = profile.winBonus;
  if (result === "loss") resultBonus = -profile.lossPenalty;

  const avgLossPenalty = Math.min(
    180,
    Math.sqrt(Math.max(0, avgLoss)) * profile.mistakeScale * 5
  );

  const perf =
    rating +
    accAdjustment -
    mistakePenalty -
    avgLossPenalty +
    highlightBonus +
    resultBonus;

  return clamp(Math.round(perf), 100, 3800);
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

  qualities.forEach((q, index) => {
    const moveColor = index % 2 === 0 ? "white" : "black";
    if (moveColor !== color) return;

    const name = qualityDisplayName(q.type, q.severity);
    if (stats[name] !== undefined) stats[name]++;

    const baseRating =
      color === "white" ? meta.whiteRating : meta.blackRating;

    const moveAcc = moveAccuracyFromWinLoss(q, baseRating);

    if (moveAcc !== null) {
      let weight = 1;

      if (q.type === "book") weight = 0.15;
      else if (q.forced) weight = 0.35;
      else if (q.type === "best") weight = 1.1;
      else if (q.type === "brilliant") weight = 1.25;

      if (q.severity === "inaccuracy") weight = 1.2;
      if (q.severity === "mistake") weight = 1.6;
      if (q.severity === "miss") weight = 2.0;
      if (q.severity === "blunder") weight = 3.0;

      totalAccuracy += moveAcc * weight;
      countedMoves += weight;
    }

    totalLoss += Math.max(0, q.evalLoss || 0);
  });

  const accuracy = countedMoves
    ? totalAccuracy / countedMoves
    : 100;

  const baseRating =
    color === "white" ? meta.whiteRating : meta.blackRating;

  const estimatedRating = estimatePerformanceRating(
    accuracy,
    baseRating,
    stats,
    result,
    totalLoss / Math.max(1, countedMoves)
  );

  return {
    stats,
    avgLoss: countedMoves ? totalLoss / countedMoves : 0,
    accuracy,
    estimatedRating,
  };
}

function evalToCp(ev) {
  if (!ev) return 0;
  if (ev.type === "mate") return ev.value > 0 ? 1000 : -1000;
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
    cp = ev.value > 0 ? 1000 : -1000;
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
      ev.type === "mate" ? `M${ev.value}` : (cp / 100).toFixed(1);
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
      evalEl.innerHTML = `<strong>Eval:</strong> ${ev.type === "mate" ? "M" + ev.value : (ev.value / 100).toFixed(1)}`;
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
