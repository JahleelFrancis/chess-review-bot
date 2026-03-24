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
  const evalData = window.analysisResult?.evaluations[window.currentMoveIndex];
  if (!evalData || !evalData.best_move) {
    console.log("No best move, clearing arrows");
    clearArrows();
    return;
  }

  const bestMove = evalData.best_move;
  if (bestMove.length < 4) return;
  const from = bestMove.slice(0, 2);
  const to = bestMove.slice(2, 4);
  drawArrow(from, to);
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
    return;
  }

  if (!window.analysisResult || !window.analysisResult.evaluations) {
    evalEl.innerHTML = "<strong>Eval:</strong> —";
    bestMoveEl.innerHTML = "<strong>Best move:</strong> —";
    updateEvalBar();
    drawBestMoveArrow();
    return;
  }

  const evalData = window.analysisResult.evaluations[window.currentMoveIndex];
  if (!evalData) {
    evalEl.innerHTML = "<strong>Eval:</strong> —";
    bestMoveEl.innerHTML = "<strong>Best move:</strong> —";
    updateEvalBar();
    drawBestMoveArrow();
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
  if (!controls || controls.children.length > 0) return; // already created

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

  // Build move list
  const moveListDiv = document.getElementById("moveList");
  if (moveListDiv) {
    moveListDiv.innerHTML = "";
    const table = document.createElement("table");
    table.className = "move-table";
    const moves = analysisResult.moves || [];

    for (let ply = 0; ply < moves.length; ply += 2) {
      const moveNumber = ply / 2 + 1;
      const whiteMove = moves[ply];
      const blackMove = moves[ply + 1];

      const tr = document.createElement("tr");
      tr.className = "animatedRow";
      tr.style.animationDelay = `${Math.min(ply, 10) * 14}ms`;

      const tdNum = document.createElement("td");
      tdNum.className = "move-num";
      tdNum.innerText = moveNumber + ".";
      tr.appendChild(tdNum);

      const tdWhite = document.createElement("td");
      tdWhite.className = "move-cell";
      tdWhite.innerText = whiteMove ?? "";
      tdWhite.dataset.ply = String(ply);
      tr.appendChild(tdWhite);

      const tdBlack = document.createElement("td");
      tdBlack.className = "move-cell";
      tdBlack.innerText = blackMove ?? "";
      if (blackMove != null) tdBlack.dataset.ply = String(ply + 1);
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