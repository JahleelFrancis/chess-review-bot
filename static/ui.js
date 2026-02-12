window.initAnalysisUI = function initAnalysisUI(analysisResult) {
  // create the chessboard instance once
  if (!window.boardApi) {
    window.boardApi = Chessboard('board', {
      position: 'start',
      pieceTheme: '/img/chesspieces/wikipedia/{piece}.png',
      draggable: false
    });

    const controls = document.getElementById("analysisControls");
    controls.innerHTML = "";

    const prevBtn = document.createElement("button");
    prevBtn.innerText = "Previous Move";

    const nextBtn = document.createElement("button");
    nextBtn.innerText = "Next Move";

    controls.appendChild(prevBtn);
    controls.appendChild(nextBtn);

    prevBtn.onclick = function () {
      if (window.currentMoveIndex > 0) {
        window.currentMoveIndex--;
        window.boardApi.position(window.analysisResult.fens[window.currentMoveIndex], true);
      }
    };

    nextBtn.onclick = function () {
      if (window.currentMoveIndex < window.maxIndex) {
        window.currentMoveIndex++;
        window.boardApi.position(window.analysisResult.fens[window.currentMoveIndex], true);
      }
    };
  }

  // always update these per analysis
  window.analysisResult = analysisResult;
  window.currentMoveIndex = 0;
  window.maxIndex = analysisResult.fens.length - 1;

  // show start position
  window.boardApi.position(analysisResult.fens[0], true);
};
