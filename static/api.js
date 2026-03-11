/*
  api.js
  ------
  Backend/API + DOM rendering helpers.

  Because we're not using a bundler, these functions are attached to window:
  - window.fetchData(url): fetch archives for a username and render archive buttons
  - window.fetchArchiveGames(username, archive): fetch games in a specific month and render game buttons
  - window.postData({pgn}): POST to /api/analyze (returns fens + moves right now)

  UI Flow now:
  - fetchData() renders monthly archive buttons
  - clicking an archive calls fetchArchiveGames()
  - clicking a game:
      1) renders Info panel (metadata + PGN)
      2) immediately calls /api/analyze to get fens+moves
      3) initializes board/moves UI via window.initAnalysisUI(result)
      4) switches to Moves tab (Option 1)
      5) enables the bottom-bar Analyze button (Stockfish later)
*/

// Small helper to let UI repaint before heavy work (optional but nice)
async function yieldNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

// Lightweight "analysis" for now = parse PGN -> return { fens, moves } from backend
async function analyzeGameFromPGN(pgn) {
  const analysisResult = await window.postData({ pgn });
  console.log("Analysis result:", analysisResult);
  return analysisResult;
}

// Enable the Analyze button that ui.js created in the bottom control bar.
// We don't modify ui.js here; we just find it in the controls container.
function enableBottomAnalyzeButton() {
  const controls = document.getElementById("analysisControls");
  if (!controls) return;

  const buttons = Array.from(controls.querySelectorAll("button"));
  const analyzeBtn = buttons.find((b) => (b.innerText || "").trim() === "Analyze");
  if (analyzeBtn) analyzeBtn.disabled = false;
}

window.fetchArchiveGames = async function fetchArchiveGames(username, archive) {
  // Backend endpoint for a month's games:
  // /api/chesscom/{username}/games?archive=YYYY/MM
  const archiveUrl = `/api/chesscom/${username}/games?archive=${archive}`;

  try {
    const response = await fetch(archiveUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const gamesDiv = document.getElementById("games");
    gamesDiv.innerHTML = "";

    // Render each game as a button the user can click to inspect details/PGN
    data.games.forEach((game) => {
      // Determine outcome label based on Chess.com result fields
      let outcome = "Draw";
      if (game.white.result === "win") {
        outcome = "White Wins";
      } else if (game.black.result === "win") {
        outcome = "Black Wins";
      }

      const gameButton = document.createElement("button");
      gameButton.innerText = `${game.white.username} (W) vs ${game.black.username} (B) - ${outcome}`;

      /*
        Clicking a game (NEW FLOW):
        - Render Info panel (metadata + PGN)
        - Immediately call /api/analyze to get fens + moves (lightweight)
        - Initialize board + move list right away
        - Switch to Moves tab (Option 1)
        - Enable bottom Analyze button (Stockfish later)
      */
      gameButton.onclick = async function handleGameButtonClick() {
        // Store PGN globally (future: stockfish analysis button uses this)
        window.selectedGamePGN = game.pgn;
        console.log("Selected game PGN:", window.selectedGamePGN);

        // Render Info panel (NO analyze button here anymore)
        const analysisDiv = document.getElementById("analysis");
        analysisDiv.innerHTML = `
          <h3>Game Analysis</h3>
          <p><strong>White:</strong> ${game.white.username} (${game.white.rating})</p>
          <p><strong>Black:</strong> ${game.black.username} (${game.black.rating})</p>
          <p><strong>Result:</strong> ${outcome}</p>
          <p><strong>Time Control:</strong> ${game.time_control}</p>
          <p><strong>Date:</strong> ${new Date(game.end_time * 1000).toLocaleDateString()}</p>
          <p><a href="${game.url}" target="_blank">View on Chess.com</a></p>
          <h3>PGN:</h3>
          <pre id="pgnBox"></pre>
        `;

        document.getElementById("pgnBox").innerText = game.pgn;

        // Optional: briefly show info tab while loading (then we jump to moves after init)
        if (window.setActiveTab) window.setActiveTab("info");

        await yieldNextFrame();

        try {
          const result = await analyzeGameFromPGN(window.selectedGamePGN);
          if (!result) {
            alert("Failed to load game. Please try again.");
            return;
          }

          // Initialize board + move list UI
          if (typeof window.initAnalysisUI === "function") {
            window.initAnalysisUI(result);
          } else {
            console.warn("window.initAnalysisUI is not defined. Skipping UI initialization.");
          }

          // Option 1: show Moves tab immediately after board/moves render
          if (window.setActiveTab) window.setActiveTab("moves");

          // Enable the bottom-bar Analyze button (Stockfish later)
          enableBottomAnalyzeButton();
        } catch (error) {
          console.error("Error during game load:", error);
          alert("An error occurred while loading the game. Please try again.");
        }
      };

      gamesDiv.appendChild(gameButton);
    });
  } catch (error) {
    console.error("Error fetching archive games:", error);
  }
};

/*
  fetchData(url)
  --------------
  Generic GET helper used for fetching and rendering archive months.

  Current usage:
  - Called from app.js after the user submits a username
  - Expects a response like: { archives: ["https://.../YYYY/MM", ...] }
  - Renders each archive month as a clickable button
*/
window.fetchData = async function fetchData(url) {
  try {
    const response = await fetch(url);

    // If backend returns 404/500/etc, throw so it lands in catch()
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // <div> container where we render archive buttons
    const archivesDiv = document.getElementById("archives");

    // Clear any previously displayed archives (important when fetching a new username)
    archivesDiv.innerHTML = "";

    // Create one button per archive month
    data.archives.forEach((archive) => {
      const archiveButton = document.createElement("button");

      // Convert archive URL into "YYYY/MM" for the query param,
      // and display it in a more readable "Archive: MM / YYYY" format
      const archiveSegments = archive.split("/");
      const archiveMonth = archiveSegments.at(-1);
      const archiveYear = archiveSegments.at(-2);
      const archiveParam = `${archiveYear}/${archiveMonth}`;

      archiveButton.innerText = `Archive: ${archiveMonth} / ${archiveYear}`;

      // Clicking an archive fetches the games in that month and renders game buttons
      archiveButton.onclick = () => window.fetchArchiveGames(window.currentUsername, archiveParam);

      archivesDiv.appendChild(archiveButton);
    });
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

/*
  postData(data)
  --------------
  POST helper for the analysis endpoint.

  Current usage:
  - Sends { pgn: "<PGN text>" } to /api/analyze
  - Backend returns fens + moves (lightweight parsing)
  - Later: backend will return Stockfish eval/best lines when Analyze is pressed
*/
window.postData = async function postData(data = {}) {
  const postURL = "/api/analyze";

  try {
    const response = await fetch(postURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    // Try JSON first; fall back to text if needed
    let payload;
    try {
      payload = await response.json();
    } catch {
      payload = await response.text();
    }

    if (response.ok) {
      console.log("Analysis response:", payload);
      return payload;
    } else {
      console.error("Error response:", response.status, payload);
      throw new Error(`HTTP error! status: ${response.status}`);
    }
  } catch (error) {
    console.error("Error posting data:", error);
    return null;
  }
};