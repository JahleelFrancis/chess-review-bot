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

function renderBoardPlayers() {
  const topName = document.getElementById("boardPlayerTopName");
  const bottomName = document.getElementById("boardPlayerBottomName");
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
}

function clearBoardPlayers() {
  const topName = document.getElementById("boardPlayerTopName");
  const bottomName = document.getElementById("boardPlayerBottomName");

  if (topName) topName.textContent = "—";
  if (bottomName) bottomName.textContent = "—";
}

function clearAnalysisState() {
  window.analysisResult = null;
  window.currentMoveIndex = 0;
  window.maxIndex = 0;
  window.selectedGamePGN = null;
  window.currentGameMeta = null;

  const moveListDiv = document.getElementById("moveList");
  if (moveListDiv) moveListDiv.innerHTML = "";

  const analysisDiv = document.getElementById("analysis");
  if (analysisDiv) analysisDiv.innerHTML = "";

  clearBoardPlayers();

  if (window.boardApi) {
    window.boardApi.position("start", false);
  }

  const tabMoves = document.getElementById("tabMoves");
  if (tabMoves) tabMoves.disabled = true;

  setActiveTab("info");
}

function showAnalysisMode() {
  const browse = document.getElementById("browseLayout");
  const analysis = document.getElementById("analysisLayout");

  if (browse) browse.style.display = "none";
  if (analysis) analysis.style.display = "grid";
}

function showBrowseMode() {
  const browse = document.getElementById("browseLayout");
  const analysis = document.getElementById("analysisLayout");

  if (analysis) analysis.style.display = "none";
  if (browse) browse.style.display = "flex";

  const tabMoves = document.getElementById("tabMoves");
  if (tabMoves) tabMoves.disabled = true;

  setActiveTab("info");
}

window.initAnalysisUI = function initAnalysisUI(analysisResult) {
  ensureTabsInitialized();
  showAnalysisMode();
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

  const controls = document.getElementById("analysisControls");
  if (controls) {
    controls.innerHTML = "";

    const resetBtn = document.createElement("button");
    resetBtn.innerText = "<<";

    const prevBtn = document.createElement("button");
    prevBtn.innerText = "<";

    const analyzeBtn = document.createElement("button");
    analyzeBtn.innerText = "Analyze";

    const nextBtn = document.createElement("button");
    nextBtn.innerText = ">";

    const lastMoveBtn = document.createElement("button");
    lastMoveBtn.innerText = ">>";

    controls.appendChild(resetBtn);
    controls.appendChild(prevBtn);
    controls.appendChild(analyzeBtn);
    controls.appendChild(nextBtn);
    controls.appendChild(lastMoveBtn);

    resetBtn.onclick = function () {
      if (!window.analysisResult) return;
      window.currentMoveIndex = 0;
      window.boardApi.position(window.analysisResult.fens[0], false);
      updateActiveMoveHighlight();
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
    };

    analyzeBtn.onclick = function () {
      alert("Stockfish analysis coming soon 🙂");
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
    };

    lastMoveBtn.onclick = function () {
      if (!window.analysisResult) return;
      window.currentMoveIndex = window.maxIndex;
      window.boardApi.position(
        window.analysisResult.fens[window.currentMoveIndex],
        true
      );
      updateActiveMoveHighlight();
    };
  }

  window.analysisResult = analysisResult;
  window.currentMoveIndex = 0;
  window.maxIndex = analysisResult.fens.length - 1;

  window.boardApi.position(analysisResult.fens[0], false);

  const moveListDiv = document.getElementById("moveList");
  if (!moveListDiv) return;

  moveListDiv.innerHTML = "";

  const table = document.createElement("table");
  table.className = "move-table";

  const moves = analysisResult.moves || [];

  for (let ply = 0; ply < moves.length; ply += 2) {
    const moveNumber = ply / 2 + 1;
    const whiteMove = moves[ply];
    const blackMove = moves[ply + 1];

    const tr = document.createElement("tr");

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
  };

  updateActiveMoveHighlight();
};

window.setActiveTab = setActiveTab;
window.showBrowseMode = showBrowseMode;
window.showAnalysisMode = showAnalysisMode;
window.clearAnalysisState = clearAnalysisState;