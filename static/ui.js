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

window.initAnalysisUI = function initAnalysisUI(analysisResult) {
  // Basic guard so we don't crash if something unexpected is passed in
  if (
    !analysisResult ||
    !Array.isArray(analysisResult.fens) ||
    analysisResult.fens.length === 0
  ) {
    console.error("initAnalysisUI: invalid analysisResult", analysisResult);
    return;
  }

  // Check whether the board and controls were already created on a previous call.
  // This prevents rebuilding the same DOM/UI objects every time new analysis arrives.
  if (!window.boardApi) {
    // Create and store one shared chessboard instance on window for cross-handler access.
    // Storing it globally is necessary because button handlers need to update board state later.
    window.boardApi = Chessboard("board", {
      position: "start",
      pieceTheme: "/img/chesspieces/wikipedia/{piece}.png",
      draggable: false,
    });

    // Get the container where replay controls (previous/next/reset) will be placed.
    const controls = document.getElementById("analysisControls");

    // Remove any existing control markup inside that container.
    controls.innerHTML = "";

    const prevBtn = document.createElement("button");
    prevBtn.innerText = "Previous Move";

    // Reset button (requested)
    const resetBtn = document.createElement("button");
    resetBtn.innerText = "Reset";

    const nextBtn = document.createElement("button");
    nextBtn.innerText = "Next Move";

    // Add buttons to the controls container
    controls.appendChild(prevBtn);
    controls.appendChild(resetBtn);
    controls.appendChild(nextBtn);

    // Register click behavior for stepping to the previous FEN position.
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

    // Reset to start position
    resetBtn.onclick = function () {
      window.currentMoveIndex = 0;
      window.boardApi.position(window.analysisResult.fens[0], false);
      updateActiveMoveHighlight();
    };

    // Register click behavior for stepping to the next FEN position.
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
  }

  // Store the latest analysis payload globally for button handlers to access.
  window.analysisResult = analysisResult;

  // Reset replay to the beginning whenever new analysis is loaded.
  window.currentMoveIndex = 0;

  // Compute and store the last valid replay index from FEN count.
  window.maxIndex = analysisResult.fens.length - 1;

  // Immediately render the first analyzed position on load/update (no animation).
  window.boardApi.position(analysisResult.fens[0], false);

  // Render move list as a table (move number | White | Black)
  const moveListDiv = document.getElementById("moveList");
  if (!moveListDiv) return;

  moveListDiv.innerHTML = ""; // Clear any existing move list content

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

  // One click handler for the whole table (event delegation)
  moveListDiv.onclick = function (e) {
    const cell = e.target.closest(".move-cell");
    if (!cell) return;

    const plyStr = cell.dataset.ply;
    if (!plyStr) return; // clicked blank black cell at end of game

    const ply = Number(plyStr);
    if (!Number.isFinite(ply)) return;

    // ply 0 => fens[1], ply 1 => fens[2], etc.
    window.currentMoveIndex = ply + 1;
    window.boardApi.position(analysisResult.fens[window.currentMoveIndex], true);
    updateActiveMoveHighlight();
  };

  // At start position, nothing should be highlighted
  updateActiveMoveHighlight();
};