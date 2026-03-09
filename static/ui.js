window.initAnalysisUI = function initAnalysisUI(analysisResult) {
  // Expose a globally callable initializer so other scripts can start/update the analysis UI.
  // This is necessary because the app calls this function after receiving analysis data.

  // Check whether the board and controls were already created on a previous call.
  // This prevents rebuilding the same DOM/UI objects every time new analysis arrives.
  if (!window.boardApi) {
    // Create and store one shared chessboard instance on window for cross-handler access.
    // Storing it globally is necessary because button handlers need to update board state later.
    window.boardApi = Chessboard('board', {
      position: 'start',
      pieceTheme: '/img/chesspieces/wikipedia/{piece}.png',
      draggable: false
    });

    // Get the container where replay controls (previous/next) will be placed.
    // Required so we can inject navigation buttons into the existing page structure.
    const controls = document.getElementById("analysisControls");

    // Remove any existing control markup inside that container.
    // Necessary to avoid duplicate buttons if container had old content.
    controls.innerHTML = "";

    const prevBtn = document.createElement("button");

    prevBtn.innerText = "Previous Move";

    const nextBtn = document.createElement("button");

    nextBtn.innerText = "Next Move";

    // Attach the previous button to the controls container in the DOM.
    controls.appendChild(prevBtn);

    // Attach the next button to the controls container in the DOM.
    controls.appendChild(nextBtn);

    // Register click behavior for stepping to the previous FEN position.
    prevBtn.onclick = function () {
      if (window.currentMoveIndex > 0) {
        window.currentMoveIndex--;

        // Re-render the board using the updated FEN at the new index.
        window.boardApi.position(window.analysisResult.fens[window.currentMoveIndex], true);
      }
    };

    // Register click behavior for stepping to the next FEN position.
    nextBtn.onclick = function () {
      if (window.currentMoveIndex < window.maxIndex) {
        window.currentMoveIndex++;

        // Re-render board using FEN at the new index.
        window.boardApi.position(window.analysisResult.fens[window.currentMoveIndex], true);
      }
    };
  }

  // Store the latest analysis payload globally for button handlers to access.
  window.analysisResult = analysisResult;

  // Reset replay to the beginning whenever new analysis is loaded.
  window.currentMoveIndex = 0;

  // Compute and store the last valid replay index from FEN count.
  window.maxIndex = analysisResult.fens.length - 1;

  // Immediately render the first analyzed position on load/update.
  // Necessary so users see board state without pressing a button first.
  window.boardApi.position(analysisResult.fens[0], true);

  const moveListDiv = document.getElementById("moveList");  
  moveListDiv.innerHTML = ""; // Clear any existing move list content
  
  const moveList = document.createElement("ol"); // Create an ordered list for moves
  analysisResult.moves.forEach((move, index) => {
    const moveItem = document.createElement("li"); // Create a list item for each move
    moveItem.innerText = move; // Set the text to the move notation
    moveItem.onclick = function() {
      window.currentMoveIndex = index + 1; // Set current index to the move's corresponding FEN (index + 1 because FENs are offset by 1 from moves)
      window.boardApi.position(analysisResult.fens[window.currentMoveIndex], true); // Update the board to the selected move's position
    };
    moveList.appendChild(moveItem); // Add the move to the list
  });
  moveListDiv.appendChild(moveList); // Add the complete move list to the page
};
