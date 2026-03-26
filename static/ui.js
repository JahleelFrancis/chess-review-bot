function setActiveTab(tabName) {
  const tabMoves = document.getElementById("tabMoves");
  const tabInfo = document.getElementById("tabInfo");
  const movesPanel = document.getElementById("movesPanel");
  const infoPanel = document.getElementById("infoPanel");

  if (!tabMoves || !tabInfo || !movesPanel || !infoPanel) return;

  if (tabName === "info") {
    tabMoves.classList.remove("active");
    tabInfo.classList.add("active");
    movesPanel.classList.remove("active");
    infoPanel.classList.add("active");
  } else {
    tabInfo.classList.remove("active");
    tabMoves.classList.add("active");
    infoPanel.classList.remove("active");
    movesPanel.classList.add("active");
  }
}

function ensureTabsInitialized() {
  if (window.__tabsInitialized) return;

  const tabMoves = document.getElementById("tabMoves");
  const tabInfo = document.getElementById("tabInfo");

  if (!tabMoves || !tabInfo) return;

  tabMoves.onclick = () => setActiveTab("moves");
  tabInfo.onclick = () => setActiveTab("info");

  setActiveTab("moves");
  window.__tabsInitialized = true;
}

function updateActiveMoveHighlight() {
  const moveListDiv = document.getElementById("moveList");
  if (!moveListDiv) return;

  moveListDiv
    .querySelectorAll(".move-cell.active-move")
    .forEach((el) => el.classList.remove("active-move"));

  if (!window.analysisResult || window.currentMoveIndex <= 0) return;

  const ply = window.currentMoveIndex - 1;
  const cell = moveListDiv.querySelector(`.move-cell[data-ply="${ply}"]`);
  if (!cell) return;

  cell.classList.add("active-move");
  cell.scrollIntoView({ block: "nearest" });
}

function formatEvalLabel(evalData) {
  if (!evalData) return "0.0";

  if (evalData.type === "mate") {
    const sign = evalData.value > 0 ? "+" : "";
    return `M${sign}${evalData.value}`;
  }

  const pawns = (evalData.value / 100).toFixed(1);
  return evalData.value > 0 ? `+${pawns}` : pawns;
}

function updateEvalBar() {
  const blackEl = document.getElementById("evalBarBlack");
  const whiteEl = document.getElementById("evalBarWhite");
  const labelEl = document.getElementById("evalBarLabel");

  if (!blackEl || !whiteEl || !labelEl) return;

  let whitePercent = 50;
  let label = "0.0";

  const evals = window.analysisResult?.evaluations;
  const evalData = Array.isArray(evals) ? evals[window.currentMoveIndex] : null;

  if (evalData) {
    label = formatEvalLabel(evalData);

    if (evalData.type === "mate") {
      whitePercent = evalData.value > 0 ? 100 : 0;
    } else {
      const cp = Number(evalData.value || 0);
      const clamped = Math.max(-600, Math.min(600, cp));
      whitePercent = 50 + (clamped / 600) * 50;
    }
  }

  whitePercent = Math.max(0, Math.min(100, whitePercent));
  const blackPercent = 100 - whitePercent;

  whiteEl.style.height = `${whitePercent}%`;
  blackEl.style.height = `${blackPercent}%`;
  labelEl.textContent = label;
}

// Arrow helpers
let arrowSvg = null;
let currentArrowMarkerId = null;

function initArrowOverlay() {
  const boardEl = document.getElementById("board");
  if (!boardEl) {
    console.warn("initArrowOverlay: board element not found");
    return null;
  }

  const container = boardEl.parentElement;
  if (!container) return null;
  container.style.position = "relative";

  if (arrowSvg && arrowSvg.parentElement === container) {
    return arrowSvg;
  }

  if (arrowSvg && arrowSvg.parentElement) {
    arrowSvg.parentElement.removeChild(arrowSvg);
  }

  arrowSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  arrowSvg.style.position = "absolute";
  arrowSvg.style.top = "0";
  arrowSvg.style.left = "0";
  arrowSvg.style.width = "100%";
  arrowSvg.style.height = "100%";
  arrowSvg.style.pointerEvents = "none";
  arrowSvg.style.zIndex = "10";
  container.appendChild(arrowSvg);

  console.log("Arrow overlay created");
  return arrowSvg;
}

function clearArrows() {
  if (!arrowSvg) return;
  while (arrowSvg.firstChild) {
    arrowSvg.removeChild(arrowSvg.firstChild);
  }
  currentArrowMarkerId = null;
  console.log("Arrows cleared");
}

function drawArrow(fromSquare, toSquare, color = "#ffaa44") {
  console.log(`drawArrow called: ${fromSquare} → ${toSquare}`);
  const svg = initArrowOverlay();
  if (!svg) {
    console.warn("drawArrow: no SVG overlay");
    return;
  }

  clearArrows();

  const boardEl = document.getElementById("board");
  const container = boardEl.parentElement;
  const boardRect = boardEl.getBoundingClientRect();
  const containerRect = container.getBoundingClientRect();
  const boardWidth = boardRect.width;
  const boardHeight = boardRect.height;
  console.log(`Board size: ${boardWidth}x${boardHeight}`);

  if (boardWidth === 0 || boardHeight === 0) {
    console.warn("Board has zero size, retrying in 100ms");
    setTimeout(() => drawArrow(fromSquare, toSquare, color), 100);
    return;
  }

  const squareSize = boardWidth / 8;
  const boardLeft = boardRect.left - containerRect.left;
  const boardTop = boardRect.top - containerRect.top;

  function squareToCoords(sq) {
    const file = sq.charCodeAt(0) - 97;
    const rank = parseInt(sq[1]) - 1;
    const x = boardLeft + file * squareSize + squareSize / 2;
    const y = boardTop + (7 - rank) * squareSize + squareSize / 2;
    return { x, y };
  }

  const from = squareToCoords(fromSquare);
  const to = squareToCoords(toSquare);
  console.log(`Coordinates: from(${from.x},${from.y}) to(${to.x},${to.y})`);

  let defs = svg.querySelector("defs");
  if (!defs) {
    defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    svg.appendChild(defs);
  }

  const markerId = `arrow-${Date.now()}-${Math.random()}`;
  currentArrowMarkerId = markerId;

  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", markerId);
  marker.setAttribute("markerWidth", "8");
  marker.setAttribute("markerHeight", "8");
  marker.setAttribute("refX", "7");
  marker.setAttribute("refY", "4");
  marker.setAttribute("orient", "auto");
  const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  polygon.setAttribute("points", "0 0, 8 4, 0 8");
  polygon.setAttribute("fill", color);
  marker.appendChild(polygon);
  defs.appendChild(marker);

  const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
  line.setAttribute("x1", from.x);
  line.setAttribute("y1", from.y);
  line.setAttribute("x2", to.x);
  line.setAttribute("y2", to.y);
  line.setAttribute("stroke", color);
  line.setAttribute("stroke-width", "3");
  line.setAttribute("stroke-linecap", "round");
  line.setAttribute("opacity", "0.8");
  line.setAttribute("marker-end", `url(#${markerId})`);
  svg.appendChild(line);
  console.log("Arrow drawn");
}

function drawBestMoveArrow() {
  console.log("drawBestMoveArrow called");

  const moveIndex = window.currentMoveIndex - 1;
  // Only show arrow if the move that led to this position was a mistake (quality not null)
  if (moveIndex >= 0 && window.moveQualities && window.moveQualities[moveIndex] !== null) {
    const evalData = window.analysisResult?.evaluations[window.currentMoveIndex];
    if (evalData && evalData.best_move) {
      const bestMove = evalData.best_move;
      if (bestMove.length >= 4) {
        const from = bestMove.slice(0, 2);
        const to = bestMove.slice(2, 4);
        drawArrow(from, to);
        return;
      }
    }
  }

  clearArrows();
}

// Compute move qualities (blunder, mistake, inaccuracy) based on evaluation drop
function computeMoveQualities(evaluations, moves) {
  if (!evaluations || moves.length === 0) return [];

  const qualities = [];

  for (let i = 0; i < moves.length; i++) {
    const beforeEval = evaluations[i];
    const afterEval = evaluations[i + 1];
    if (!beforeEval || !afterEval) {
      qualities.push(null);
      continue;
    }

    function getCentipawns(e) {
      if (e.type === "mate") {
        return e.value > 0 ? 10000 : -10000;
      }
      return e.value;
    }

    const beforeCp = getCentipawns(beforeEval);
    const afterCp = getCentipawns(afterEval);

    const isWhiteMove = (i % 2 === 0);
    let drop;
    if (isWhiteMove) {
      drop = beforeCp - afterCp;
    } else {
      drop = afterCp - beforeCp;
    }

    const absDrop = Math.abs(drop);
    let severity = null;
    if (absDrop > 120) {
      severity = "blunder";
    } else if (absDrop > 50) {
      severity = "mistake";
    } else if (absDrop > 30) {
      severity = "inaccuracy";
    }

    qualities.push(severity);
  }
  return qualities;
}

// Convert UCI move to human-readable description
function describeMove(uci, fen) {
  if (!uci) return "??";

  // Try to use chess.js
  if (typeof Chess !== "undefined") {
    try {
      const board = new Chess(fen);
      const move = board.move(uci, { sloppy: true });
      if (move) {
        // Castling
        if (move.san === "O-O" || move.san === "O-O-O") {
          return move.san === "O-O" ? "castling kingside" : "castling queenside";
        }

        const pieceName = move.piece === 'p' ? 'pawn' :
                          move.piece === 'n' ? 'knight' :
                          move.piece === 'b' ? 'bishop' :
                          move.piece === 'r' ? 'rook' :
                          move.piece === 'q' ? 'queen' : 'king';
        const toSquare = move.to.toUpperCase();

        if (move.promotion) {
          const promo = move.promotion === 'q' ? 'queen' :
                        move.promotion === 'r' ? 'rook' :
                        move.promotion === 'b' ? 'bishop' : 'knight';
          return `promoting your pawn to a ${promo}`;
        }

        if (move.captured) {
          const capturedName = move.captured === 'p' ? 'pawn' :
                               move.captured === 'n' ? 'knight' :
                               move.captured === 'b' ? 'bishop' :
                               move.captured === 'r' ? 'rook' :
                               move.captured === 'q' ? 'queen' : '';
          return `capturing the ${capturedName} on ${toSquare} with your ${pieceName}`;
        }

        return `moving your ${pieceName} to ${toSquare}`;
      }
    } catch (e) {
      console.warn("chess.js describeMove error", e);
    }
  }

  // Fallback: manual parsing using chess.js to get piece if available
  if (typeof Chess !== "undefined") {
    try {
      const board = new Chess(fen);
      const from = uci.slice(0, 2);
      const to = uci.slice(2, 4);
      const piece = board.get(from);
      if (piece) {
        const pieceName = piece.type === 'p' ? 'pawn' :
                          piece.type === 'n' ? 'knight' :
                          piece.type === 'b' ? 'bishop' :
                          piece.type === 'r' ? 'rook' :
                          piece.type === 'q' ? 'queen' : 'king';
        const toSquare = to.toUpperCase();

        // Check if it's a capture by seeing if the destination square has an enemy piece
        const targetPiece = board.get(to);
        if (targetPiece && targetPiece.color !== piece.color) {
          const capturedName = targetPiece.type === 'p' ? 'pawn' :
                               targetPiece.type === 'n' ? 'knight' :
                               targetPiece.type === 'b' ? 'bishop' :
                               targetPiece.type === 'r' ? 'rook' :
                               targetPiece.type === 'q' ? 'queen' : '';
          return `capturing the ${capturedName} on ${toSquare} with your ${pieceName}`;
        }
        return `moving your ${pieceName} to ${toSquare}`;
      }
    } catch (e) {
      console.warn("manual parse error", e);
    }
  }

  // Last resort: just show UCI
  return uci;
}

// Tactical description of the best move (extra info)
function getTacticalDescription(bestMoveUci, beforeFen) {
  if (!bestMoveUci || typeof Chess === "undefined") return "";

  try {
    const board = new Chess(beforeFen);
    const move = board.move(bestMoveUci);
    if (!move) return "";

    let description = "";

    if (board.in_check()) {
      description += "delivers check";
    }

    if (move.captured) {
      const pieceName = move.captured === 'p' ? 'pawn' :
                        move.captured === 'n' ? 'knight' :
                        move.captured === 'b' ? 'bishop' :
                        move.captured === 'r' ? 'rook' :
                        move.captured === 'q' ? 'queen' : '';
      if (description) description += " and ";
      description += `captures a ${pieceName}`;
    }

    // Simple fork detection (attacks two or more enemy pieces)
    const afterBoard = new Chess(beforeFen);
    afterBoard.move(bestMoveUci);
    const movedPieceSquare = move.to;
    const boardState = afterBoard.board();
    const enemySquares = [];
    for (let i = 0; i < 8; i++) {
      for (let j = 0; j < 8; j++) {
        const piece = boardState[i][j];
        if (piece && piece.color !== afterBoard.turn()) {
          enemySquares.push(algebraicFromCoords(j, i));
        }
      }
    }
    let attackedPieces = [];
    for (const enemySquare of enemySquares) {
      const testBoard = new Chess(beforeFen);
      testBoard.move(bestMoveUci);
      const moves = testBoard.moves({ verbose: true });
      const isAttack = moves.some(m => m.from === movedPieceSquare && m.to === enemySquare && m.captured);
      if (isAttack) {
        attackedPieces.push(testBoard.get(enemySquare).type);
      }
    }
    if (attackedPieces.length >= 2) {
      const pieces = attackedPieces.map(p => p === 'p' ? 'pawn' : p === 'n' ? 'knight' : p === 'b' ? 'bishop' : p === 'r' ? 'rook' : p === 'q' ? 'queen' : '').join(' and ');
      if (description) description += " and ";
      description += `forks the ${pieces}`;
    }

    if (afterBoard.in_checkmate()) {
      description = "delivers checkmate";
    }

    if (!description) {
      description = "improves your position";
    }

    return description;
  } catch (e) {
    console.warn("Tactical description failed", e);
    return "";
  }
}

function algebraicFromCoords(file, rank) {
  const files = 'abcdefgh';
  const ranks = '87654321';
  return files[file] + ranks[rank];
}

function getUserColor() {
  const meta = window.currentGameMeta;
  if (!meta) return null;
  const searchedUser = (window.currentUsernameDisplay || window.currentUsername || "").toLowerCase();
  if (meta.whiteUsername.toLowerCase() === searchedUser) return "white";
  if (meta.blackUsername.toLowerCase() === searchedUser) return "black";
  return null;
}

function getMoverPerspective(moveIndex) {
  const userColor = getUserColor();
  if (!userColor) return null;
  const isWhiteMove = (moveIndex % 2 === 0);
  if ((isWhiteMove && userColor === "white") || (!isWhiteMove && userColor === "black")) {
    return "user";
  } else {
    return "opponent";
  }
}

// Generate insight text with natural language best move description
function getInsightsText(quality, moveSan, bestMoveUci, beforeFen, moveIndex) {
  const bestMoveDesc = describeMove(bestMoveUci, beforeFen);
  const tactical = getTacticalDescription(bestMoveUci, beforeFen);
  const tacticalPhrase = tactical ? `, which ${tactical}` : "";
  const mover = getMoverPerspective(moveIndex);
  const isUser = (mover === "user");

  if (!quality) {
    if (isUser) {
      return `✅ Good move. Keeps the position steady.`;
    } else {
      return `✅ Opponent played a solid move.`;
    }
  }

  let message = "";
  if (isUser) {
    if (quality === "blunder") {
      message = `⚠️ You blundered! ${moveSan} was a critical error. The best move was ${bestMoveDesc}${tacticalPhrase}.`;
    } else if (quality === "mistake") {
      message = `❗ You made a mistake. ${moveSan} is not optimal. Consider ${bestMoveDesc} instead${tacticalPhrase}.`;
    } else if (quality === "inaccuracy") {
      message = `❓ You played an inaccuracy. ${moveSan} misses a better option. ${bestMoveDesc} would have been stronger${tacticalPhrase}.`;
    }
  } else {
    if (quality === "blunder") {
      message = `🎯 Opponent blundered! ${moveSan} was a critical error. The best move was ${bestMoveDesc}${tacticalPhrase}.`;
    } else if (quality === "mistake") {
      message = `❗ Opponent made a mistake. ${moveSan} is not optimal. They should have played ${bestMoveDesc}${tacticalPhrase}.`;
    } else if (quality === "inaccuracy") {
      message = `❓ Opponent played an inaccuracy. ${moveSan} misses a better option. ${bestMoveDesc} would have been stronger${tacticalPhrase}.`;
    }
  }
  return message;
}

function updateInsights() {
  const insightsDiv = document.getElementById("insightsContent");
  if (!insightsDiv) return;

  const moveIndex = window.currentMoveIndex - 1;
  if (moveIndex >= 0 && window.moveQualities && window.moveQualities[moveIndex]) {
    const quality = window.moveQualities[moveIndex];
    const moveSan = window.analysisResult.moves[moveIndex];
    const bestMoveUci = window.analysisResult.evaluations[window.currentMoveIndex]?.best_move;
    const beforeFen = window.analysisResult.fens[moveIndex];
    const insightText = getInsightsText(quality, moveSan, bestMoveUci, beforeFen, moveIndex);
    insightsDiv.innerHTML = `<div class="insight-text">${insightText}</div>`;
  } else {
    const moveIndex = window.currentMoveIndex - 1;
    if (moveIndex >= 0) {
      const mover = getMoverPerspective(moveIndex);
      if (mover === "user") {
        insightsDiv.innerHTML = `<div class="insight-text">✅ Good move. Keeps the position steady.</div>`;
      } else if (mover === "opponent") {
        insightsDiv.innerHTML = `<div class="insight-text">✅ Opponent played a solid move.</div>`;
      } else {
        insightsDiv.innerHTML = `<div class="insight-text">No significant issues with this move.</div>`;
      }
    } else {
      insightsDiv.innerHTML = `<div class="insight-text">Select a move to see insights.</div>`;
    }
  }
}

function initialsFromName(name, fallback) {
  const value = String(name || "").trim();
  if (!value) return fallback;
  return value.slice(0, 1).toUpperCase();
}

function updateEngineInfo() {
  const evalEl = document.getElementById("currentEvalText");
  const bestMoveEl = document.getElementById("bestMoveText");

  if (!evalEl || !bestMoveEl) {
    updateEvalBar();
    drawBestMoveArrow();
    updateInsights();
    return;
  }

  if (!window.analysisResult || !window.analysisResult.evaluations) {
    evalEl.innerHTML = "<strong>Eval:</strong> —";
    bestMoveEl.innerHTML = "<strong>Best move:</strong> —";
    updateEvalBar();
    drawBestMoveArrow();
    updateInsights();
    return;
  }

  const evalData = window.analysisResult.evaluations[window.currentMoveIndex];
  if (!evalData) {
    evalEl.innerHTML = "<strong>Eval:</strong> —";
    bestMoveEl.innerHTML = "<strong>Best move:</strong> —";
    updateEvalBar();
    drawBestMoveArrow();
    updateInsights();
    return;
  }

  if (evalData.type === "mate") {
    evalEl.innerHTML = `<strong>Eval:</strong> Mate in ${evalData.value}`;
  } else {
    const pawns = (evalData.value / 100).toFixed(2);
    const signed = evalData.value > 0 ? `+${pawns}` : `${pawns}`;
    evalEl.innerHTML = `<strong>Eval:</strong> ${signed}`;
  }

  bestMoveEl.innerHTML = `<strong>Best move:</strong> ${evalData.best_move || "—"}`;
  updateEvalBar();
  drawBestMoveArrow();
  updateInsights();
}

function renderBoardPlayers() {
  const topName = document.getElementById("boardPlayerTopName");
  const bottomName = document.getElementById("boardPlayerBottomName");
  const topAvatar = document.getElementById("boardPlayerTopAvatar");
  const bottomAvatar = document.getElementById("boardPlayerBottomAvatar");
  const meta = window.currentGameMeta || {};

  if (topName) {
    topName.textContent = meta.blackUsername
      ? `${meta.blackUsername}${meta.blackRating ? ` (${meta.blackRating})` : ""}`
      : "—";
  }

  if (bottomName) {
    bottomName.textContent = meta.whiteUsername
      ? `${meta.whiteUsername}${meta.whiteRating ? ` (${meta.whiteRating})` : ""}`
      : "—";
  }

  if (topAvatar) {
    topAvatar.textContent = initialsFromName(meta.blackUsername, "B");
  }

  if (bottomAvatar) {
    bottomAvatar.textContent = initialsFromName(meta.whiteUsername, "W");
  }
}

function clearBoardPlayers() {
  const topName = document.getElementById("boardPlayerTopName");
  const bottomName = document.getElementById("boardPlayerBottomName");
  const topAvatar = document.getElementById("boardPlayerTopAvatar");
  const bottomAvatar = document.getElementById("boardPlayerBottomAvatar");

  if (topName) topName.textContent = "—";
  if (bottomName) bottomName.textContent = "—";
  if (topAvatar) topAvatar.textContent = "B";
  if (bottomAvatar) bottomAvatar.textContent = "W";
}

function buildEmptyState(title, text, icon = "") {
  return `
    <div class="emptyState compact">
      ${icon ? `<div class="emptyStateIcon">${icon}</div>` : ""}
      <div class="emptyStateTitle">${title}</div>
      <div class="emptyStateText">${text}</div>
    </div>
  `;
}

function showLandingMode() {
  const hero = document.getElementById("heroSection");
  const browse = document.getElementById("browseLayout");
  const analysis = document.getElementById("analysisLayout");
  const form = document.getElementById("usernameForm");

  if (hero) hero.classList.remove("hidden");
  if (browse) {
    browse.style.display = "none";
    browse.classList.add("preHero");
  }
  if (analysis) analysis.style.display = "none";
  if (form) form.classList.remove("visible");

  window.hasExitedHero = false;
}

function showBrowseMode() {
  const hero = document.getElementById("heroSection");
  const browse = document.getElementById("browseLayout");
  const analysis = document.getElementById("analysisLayout");
  const form = document.getElementById("usernameForm");

  if (hero) hero.classList.add("hidden");
  if (analysis) analysis.style.display = "none";
  if (browse) {
    browse.classList.remove("preHero");
    browse.style.display = "flex";
  }
  if (form) form.classList.add("visible");

  const tabMoves = document.getElementById("tabMoves");
  if (tabMoves) tabMoves.disabled = true;

  setActiveTab("info");
  window.hasExitedHero = true;
}

function showAnalysisMode() {
  const hero = document.getElementById("heroSection");
  const browse = document.getElementById("browseLayout");
  const analysis = document.getElementById("analysisLayout");
  const form = document.getElementById("usernameForm");

  if (hero) hero.classList.add("hidden");
  if (browse) browse.style.display = "none";
  if (analysis) analysis.style.display = "grid";
  if (form) form.classList.add("visible");

  window.hasExitedHero = true;
}

function clearAnalysisState() {
  window.analysisResult = null;
  window.currentMoveIndex = 0;
  window.maxIndex = 0;
  window.selectedGamePGN = null;
  window.currentGameMeta = null;
  window.moveQualities = null;

  const moveListDiv = document.getElementById("moveList");
  if (moveListDiv) {
    moveListDiv.innerHTML = buildEmptyState(
      "Choose a game to begin analysis",
      "Move-by-move review will appear here after you open a game."
    );
  }

  const analysisDiv = document.getElementById("analysis");
  if (analysisDiv) {
    analysisDiv.innerHTML = buildEmptyState(
      "Game details will appear here",
      "Open a game to view metadata, PGN, and analysis context."
    );
  }

  const insightsDiv = document.getElementById("insightsContent");
  if (insightsDiv) {
    insightsDiv.innerHTML = `<div class="insight-text">Select a game to see insights.</div>`;
  }

  clearBoardPlayers();

  if (window.boardApi) {
    window.boardApi.position("start", false);
  }

  const tabMoves = document.getElementById("tabMoves");
  if (tabMoves) tabMoves.disabled = true;

  setActiveTab("info");
  updateEvalBar();
  clearArrows();
}

function createControlButtons() {
  const controls = document.getElementById("analysisControls");
  if (!controls || controls.children.length > 0) return;

  const resetBtn = document.createElement("button");
  resetBtn.innerText = "<<";
  const prevBtn = document.createElement("button");
  prevBtn.innerText = "<";
  const nextBtn = document.createElement("button");
  nextBtn.innerText = ">";
  const lastMoveBtn = document.createElement("button");
  lastMoveBtn.innerText = ">>";

  controls.appendChild(resetBtn);
  controls.appendChild(prevBtn);
  controls.appendChild(nextBtn);
  controls.appendChild(lastMoveBtn);

  resetBtn.onclick = function () {
    if (!window.analysisResult) return;
    window.currentMoveIndex = 0;
    window.boardApi.position(window.analysisResult.fens[0], false);
    updateActiveMoveHighlight();
    updateEngineInfo();
    updateEvalBar();
  };

  prevBtn.onclick = function () {
    if (!window.analysisResult) return;
    if (window.currentMoveIndex > 0) {
      window.currentMoveIndex--;
      window.boardApi.position(
        window.analysisResult.fens[window.currentMoveIndex],
        true
      );
    }
    updateActiveMoveHighlight();
    updateEngineInfo();
    updateEvalBar();
  };

  nextBtn.onclick = function () {
    if (!window.analysisResult) return;
    if (window.currentMoveIndex < window.maxIndex) {
      window.currentMoveIndex++;
      window.boardApi.position(
        window.analysisResult.fens[window.currentMoveIndex],
        true
      );
    }
    updateActiveMoveHighlight();
    updateEngineInfo();
    updateEvalBar();
  };

  lastMoveBtn.onclick = function () {
    if (!window.analysisResult) return;
    window.currentMoveIndex = window.maxIndex;
    window.boardApi.position(
      window.analysisResult.fens[window.currentMoveIndex],
      true
    );
    updateActiveMoveHighlight();
    updateEngineInfo();
    updateEvalBar();
  };
}

window.initAnalysisUI = function initAnalysisUI(analysisResult) {
  ensureTabsInitialized();
  renderBoardPlayers();

  const tabMoves = document.getElementById("tabMoves");
  if (tabMoves) tabMoves.disabled = false;

  setActiveTab("moves");

  if (
    !analysisResult ||
    !Array.isArray(analysisResult.fens) ||
    analysisResult.fens.length === 0
  ) {
    console.error("initAnalysisUI: invalid analysisResult", analysisResult);
    return;
  }

  if (!window.boardApi) {
    window.boardApi = Chessboard("board", {
      position: "start",
      pieceTheme: "/img/chesspieces/wikipedia/{piece}.png",
      draggable: false,
    });
  }

  window.analysisResult = analysisResult;
  window.currentMoveIndex = 0;
  window.maxIndex = analysisResult.fens.length - 1;

  window.boardApi.position(analysisResult.fens[0], false);

  // Compute move qualities
  window.moveQualities = computeMoveQualities(analysisResult.evaluations, analysisResult.moves);

  // Build move list
  const moveListDiv = document.getElementById("moveList");
  if (moveListDiv) {
    moveListDiv.innerHTML = "";

    // Build move table
    const table = document.createElement("table");
    table.className = "move-table";
    const moves = analysisResult.moves || [];

    for (let ply = 0; ply < moves.length; ply += 2) {
      const moveNumber = ply / 2 + 1;
      const whiteMove = moves[ply];
      const blackMove = moves[ply + 1];
      const whiteQuality = window.moveQualities[ply];
      const blackQuality = ply + 1 < moves.length ? window.moveQualities[ply + 1] : null;

      const tr = document.createElement("tr");
      tr.className = "animatedRow";
      tr.style.animationDelay = `${Math.min(ply, 10) * 14}ms`;

      const tdNum = document.createElement("td");
      tdNum.className = "move-num";
      tdNum.innerText = moveNumber + ".";
      tr.appendChild(tdNum);

      const tdWhite = document.createElement("td");
      tdWhite.className = "move-cell";
      let whiteText = whiteMove ?? "";
      if (whiteQuality) {
        whiteText += ` ${whiteQuality === "blunder" ? "??" : (whiteQuality === "mistake" ? "?" : "?!")}`;
      }
      tdWhite.innerText = whiteText;
      tdWhite.dataset.ply = String(ply);
      tr.appendChild(tdWhite);

      const tdBlack = document.createElement("td");
      tdBlack.className = "move-cell";
      if (blackMove != null) {
        let blackText = blackMove;
        if (blackQuality) {
          blackText += ` ${blackQuality === "blunder" ? "??" : (blackQuality === "mistake" ? "?" : "?!")}`;
        }
        tdBlack.innerText = blackText;
        tdBlack.dataset.ply = String(ply + 1);
      } else {
        tdBlack.innerText = "";
      }
      tr.appendChild(tdBlack);

      table.appendChild(tr);
    }
    moveListDiv.appendChild(table);

    moveListDiv.onclick = function (e) {
      const cell = e.target.closest(".move-cell");
      if (!cell) return;
      const plyStr = cell.dataset.ply;
      if (!plyStr) return;
      const ply = Number(plyStr);
      if (!Number.isFinite(ply)) return;
      window.currentMoveIndex = ply + 1;
      window.boardApi.position(analysisResult.fens[window.currentMoveIndex], true);
      updateActiveMoveHighlight();
      updateEngineInfo();
      updateEvalBar();
    };
  }

  createControlButtons();
  updateActiveMoveHighlight();
  updateEngineInfo();
  updateEvalBar();
};

window.setActiveTab = setActiveTab;
window.showLandingMode = showLandingMode;
window.showBrowseMode = showBrowseMode;
window.showAnalysisMode = showAnalysisMode;
window.clearAnalysisState = clearAnalysisState;