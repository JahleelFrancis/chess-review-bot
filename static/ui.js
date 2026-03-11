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

// Helpers for 2-mode UI (Browse vs Analysis)
function showAnalysisMode() {
  const browse = document.getElementById("browseLayout");
  const analysis = document.getElementById("analysisLayout");

  if (browse) browse.style.display = "none";
  if (analysis) analysis.style.display = "flex";
}

function showBrowseMode() {
  const browse = document.getElementById("browseLayout");
  const analysis = document.getElementById("analysisLayout");

  if (analysis) analysis.style.display = "none";
  if (browse) browse.style.display = "flex";

  // Optional: put tabs back into "locked" state until next game is selected
  const tabMoves = document.getElementById("tabMoves");
  if (tabMoves) tabMoves.disabled = true;

  // Optional: default tab when next analysis opens
  setActiveTab("moves");
}

window.initAnalysisUI = function initAnalysisUI(analysisResult) {
  ensureTabsInitialized();

  // Switch modes immediately (hide tables, show centered analysis view)
  showAnalysisMode();

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

  // Create board + controls once
  if (!window.boardApi) {
    window.boardApi = Chessboard("board", {
      position: "start",
      pieceTheme: "/img/chesspieces/wikipedia/{piece}.png",
      draggable: false,
    });

    const controls = document.getElementById("analysisControls");
    controls.innerHTML = "";

    // NEW: Back button (one-time)
    const backBtn = document.createElement("button");
    backBtn.innerText = "Back";
    backBtn.onclick = function () {
      showBrowseMode();
    };

    const prevBtn = document.createElement("button");
    prevBtn.innerText = "Previous Move";

    const resetBtn = document.createElement("button");
    resetBtn.innerText = "Reset";

    const nextBtn = document.createElement("button");
    nextBtn.innerText = "Next Move";

    const analyzeBtn = document.createElement("button");
    analyzeBtn.innerText = "Analyze";
    analyzeBtn.disabled = true;

    // Back comes first (Chess.com vibe)
    controls.appendChild(backBtn);
    controls.appendChild(prevBtn);
    controls.appendChild(resetBtn);
    controls.appendChild(nextBtn);
    controls.appendChild(analyzeBtn);

    prevBtn.onclick = function () {
      if (window.currentMoveIndex > 0) {
        window.currentMoveIndex--;
        window.boardApi.position(
          window.analysisResult.fens[window.currentMoveIndex],
          true
        );
      }
      updateActiveMoveHighlight();
    };

    resetBtn.onclick = function () {
      window.currentMoveIndex = 0;
      window.boardApi.position(window.analysisResult.fens[0], false);
      updateActiveMoveHighlight();
    };

    nextBtn.onclick = function () {
      if (window.currentMoveIndex < window.maxIndex) {
        window.currentMoveIndex++;
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
  }

  // Store analysis result globally for easy access in controls
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

  // Iterate over moves in pairs (white+black) to create rows
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