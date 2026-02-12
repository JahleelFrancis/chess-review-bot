/*
  api.js
  ------
  Backend/API + DOM rendering helpers.

  Because we're not using a bundler, these functions are attached to window:
  - window.fetchData(url): fetch archives for a username and render archive buttons
  - window.fetchArchiveGames(username, archive): fetch games in a specific month and render game buttons
  - window.postData({pgn}): POST to /api/analyze (currently placeholder response)

  UI Flow today:
  - fetchData() renders monthly archive buttons
  - clicking an archive calls fetchArchiveGames()
  - clicking a game renders game details + PGN
  - clicking "Analyze Game" sends PGN to /api/analyze via postData()
*/
async function yieldNextFrame() {
    return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

async function analyzeGame() {
    const analysisResult = await window.postData({ pgn: window.selectedGamePGN });
    console.log("Analysis result:", analysisResult);
    return analysisResult;
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
        data.games.forEach(game => {
          // Determine outcome label based on Chess.com result fields
          let outcome = "Draw";
          if (game.white.result === "win") {
              outcome = "White Wins";
          } else if (game.black.result === "win") {
              outcome = "Black Wins";
          }

          const gameButton = document.createElement('button');
          gameButton.innerText = `${game.white.username} (W) vs ${game.black.username} (B) - ${outcome}`;

          /*
            Clicking a game:
            - Populates the analysis panel with game metadata
            - Displays PGN in a <pre>
            - Sends PGN to /api/analyze (temporary wiring; later this will be an explicit "Analyze" button)
          */
          gameButton.onclick = function handleGameButtonClick() {
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
                  <button id="analyzeButton">Analyze Game</button>
                  `;

              // Show raw PGN text (later: parse into moves/FEN for the analysis view)
              document.getElementById("pgnBox").innerText = game.pgn;

              window.selectedGamePGN = game.pgn; // Store globally for potential later use
              console.log("Selected game PGN:", window.selectedGamePGN);


              const analyzeButton = document.getElementById("analyzeButton");
              analyzeButton.onclick = async function() {
                  analyzeButton.innerText = "Analyzing...";
                  analyzeButton.disabled = true;
                  let result;
                  await yieldNextFrame(); // Allow UI to update before analysis starts
                  try{
                      result = await analyzeGame();
                      if(result == null){
                          alert("Analysis failed. Please try again."); // Handle case where postData returns null due to an error
                          return;
                      }
                      window.analysisResult = result; // Store analysis result globally for potential later use

                      if (typeof window.initAnalysisUI === "function") {
                        window.initAnalysisUI(result);
                      } else {
                        console.warn("window.initAnalysisUI is not defined. Skipping UI initialization.");
                      }


                      console.log(result.moves.length);
                      console.log(result.fens.length);
                      console.log(result.fens[0]);
                      console.log(result.fens[result.fens.length - 1]);

                  }catch(error){
                      console.error("Error during analysis:", error);
                      alert("An error occurred during analysis. Please try again.");
                      
                  }finally{
                    analyzeButton.disabled = false;
                    analyzeButton.innerText = "Analyze Game";
                  }

              }
          }

          gamesDiv.appendChild(gameButton);
        });

    } catch (error) {
        console.error("Error fetching archive games:", error);
    }
}

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
    data.archives.forEach(archive => {
        const archiveButton = document.createElement('button');

        // Convert archive URL into "YYYY/MM" for the query param,
        // and display it in a more readable "Archive: MM / YYYY" format
        const archiveSegments = archive.split('/');
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
}

/*
  postData(data)
  --------------
  POST helper for the analysis endpoint.

  Current usage:
  - Sends { pgn: "<PGN text>" } to /api/analyze
  - Backend currently returns a placeholder response
  - Later: backend will return moves, FENs, and Stockfish eval/best lines
*/
window.postData = async function postData(data = {}) {
  const postURL = "/api/analyze";

  try {
    const response = await fetch(postURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
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
}
