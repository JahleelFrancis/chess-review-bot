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
    // default to moves
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

  // default view: Moves (so you aren’t bombarded with PGN/info)
  setActiveTab("moves");

  window.__tabsInitialized = true;
}

function updateActiveMoveHighlight() {
  const moveListDiv = document.getElementById("moveList");
  if (!moveListDiv) return;

  // remove existing highlight
  moveListDiv
    .querySelectorAll(".move-cell.active-move")
    .forEach((el) => el.classList.remove("active-move"));

  if (!window.analysisResult || window.currentMoveIndex <= 0) return;

  // fen index -> ply index
  const ply = window.currentMoveIndex - 1;

  const cell = moveListDiv.querySelector(`.move-cell[data-ply="${ply}"]`);
  if (!cell) return;

  cell.classList.add("active-move");
  cell.scrollIntoView({ block: "nearest" });
}

// Called from api.js once we have analysis data ready to go
window.initAnalysisUI = function initAnalysisUI(analysisResult) {
  ensureTabsInitialized();
  const tabMoves = document.getElementById("tabMoves");
  if (tabMoves) tabMoves.disabled = false; // enable tabs once analysis is ready
  
  const layout = document.getElementById("analysisLayout");
  if (layout) layout.style.display = "flex"; // show the layout once we have data to display

  // When analysis loads, show Moves tab by default
  setActiveTab("moves");

  // Basic guard so we don't crash if something unexpected is passed in
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

    const prevBtn = document.createElement("button");
    prevBtn.innerText = "Previous Move";

    const resetBtn = document.createElement("button");
    resetBtn.innerText = "Reset";

    const nextBtn = document.createElement("button");
    nextBtn.innerText = "Next Move";

    const analyzeBtn = document.createElement("button");
    analyzeBtn.innerText = "Analyze";
    analyzeBtn.disabled = true; // enabled once a game is loaded

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

  // Store analysis for other handlers
  window.analysisResult = analysisResult;
  window.currentMoveIndex = 0;
  window.maxIndex = analysisResult.fens.length - 1;

  // Render start position (no animation)
  window.boardApi.position(analysisResult.fens[0], false);

  // Build move table (move number | white | black)
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

  // Click-to-jump (event delegation)
  moveListDiv.onclick = function (e) {
    const cell = e.target.closest(".move-cell");
    if (!cell) return;

    const plyStr = cell.dataset.ply;
    if (!plyStr) return;

    const ply = Number(plyStr);
    if (!Number.isFinite(ply)) return;

    // ply 0 => fens[1]
    window.currentMoveIndex = ply + 1;
    window.boardApi.position(analysisResult.fens[window.currentMoveIndex], true);
    updateActiveMoveHighlight();
  };

  updateActiveMoveHighlight();
};

// Optional: allow other files to switch tabs if you ever want that later
window.setActiveTab = setActiveTab;