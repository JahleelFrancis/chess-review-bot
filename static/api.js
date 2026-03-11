/*
  api.js
  ------
  Backend/API + DOM rendering helpers.

  NEW browse flow (SteamDB-ish):
  - fetchData() renders Archives as a table (Month + Games count placeholder)
  - clicking an archive calls fetchArchiveGames()
      - shows Games panel (was hidden)
      - renders Games as a table
      - updates the selected archive's "Games" count (lazy fill)
  - clicking a game:
      1) renders Info panel (metadata + PGN)
      2) calls /api/analyze (lightweight: fens + moves)
      3) initializes board/moves UI via window.initAnalysisUI(result)
      4) switches to Moves tab
      5) enables bottom Analyze button (Stockfish later)
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

/*
  fetchData(url)
  --------------
  Fetch archives for a username, then render them in a table.

  Why table + placeholder counts?
  - The Chess.com archives endpoint only gives monthly URLs.
  - It does NOT provide "number of games in that month".
  - If we tried to show counts for every month, we'd need to call the "games" endpoint
    for every archive month (tons of requests, slow, rate-limit risk).
  - So we show "—" initially, and only fill the count for the archive that the user clicks.
*/
window.fetchData = async function fetchData(url) {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    const archivesDiv = document.getElementById("archives");
    const gamesPanel = document.getElementById("gamesPanel");
    const gamesDiv = document.getElementById("games");
    const gamesHeader = document.getElementById("gamesHeader");

    // Hide games panel until an archive is clicked
    if (gamesPanel) gamesPanel.classList.add("hidden");
    if (gamesDiv) gamesDiv.innerHTML = "";
    if (gamesHeader) gamesHeader.innerText = "Games";

    // Build archives table structure
    archivesDiv.innerHTML = `
      <table class="dataTable">
        <thead>
          <tr>
            <th>Month</th>
            <th>Games</th>
          </tr>
        </thead>
        <tbody id="archivesTableBody"></tbody>
      </table>
    `;

    const tbody = document.getElementById("archivesTableBody");
    tbody.innerHTML = "";

    data.archives.reverse().forEach((archiveUrl) => {});

    // Each archive is a URL like ".../YYYY/MM"
    data.archives.forEach((archiveUrl) => {
      const segs = archiveUrl.split("/");
      const month = segs.at(-1);
      const year = segs.at(-2);

      // This is what our backend expects as the query param
      const archiveParam = `${year}/${month}`;

      const tr = document.createElement("tr");
      tr.className = "dataRow";
      tr.dataset.archive = archiveParam;

      tr.innerHTML = `
        <td>${month} / ${year}</td>
        <td class="muted" data-count="true">—</td>
      `;

      tr.onclick = () => {
        // Highlight selected archive row
        tbody.querySelectorAll(".dataRow.active").forEach((r) => r.classList.remove("active"));
        tr.classList.add("active");

        // Fetch games for this month and show them in the right column
        window.fetchArchiveGames(window.currentUsername, archiveParam);
      };

      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error fetching data:", error);
  }
};

/*
  fetchArchiveGames(username, archive)
  -----------------------------------
  Fetch all games for a given YYYY/MM, then render them as a table.

  Also:
  - Shows the Games panel (was hidden)
  - Updates the archive row's "Games" count (lazy fill)
*/
window.fetchArchiveGames = async function fetchArchiveGames(username, archive) {
  const archiveUrl = `/api/chesscom/${username}/games?archive=${archive}`;

  try {
    const response = await fetch(archiveUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    const gamesPanel = document.getElementById("gamesPanel");
    const gamesHeader = document.getElementById("gamesHeader");
    const gamesDiv = document.getElementById("games");

    // Show the games column now that we have something to show
    if (gamesPanel) gamesPanel.classList.remove("hidden");
    if (gamesHeader) gamesHeader.innerText = `Games (${archive})`;

    // Update the "Games" count cell in the selected archive row (lazy fill)
    const row = document.querySelector(`tr.dataRow[data-archive="${archive}"]`);
    if (row) {
      const countCell = row.querySelector(`td[data-count="true"]`);
      if (countCell) countCell.innerText = String(data.games.length);
    }

    // Render games as a table (SteamDB-ish)
    gamesDiv.innerHTML = `
      <table class="dataTable">
        <thead>
          <tr>
            <th>Match</th>
            <th>Result</th>
            <th>TC</th>
          </tr>
        </thead>
        <tbody id="gamesTableBody"></tbody>
      </table>
    `;

    const tbody = document.getElementById("gamesTableBody");
    tbody.innerHTML = "";

    data.games.forEach((game) => {
      let outcome = "Draw";
      if (game.white.result === "win") outcome = "White Wins";
      else if (game.black.result === "win") outcome = "Black Wins";

      const tr = document.createElement("tr");
      tr.className = "dataRow";

      tr.innerHTML = `
        <td>${game.white.username} vs ${game.black.username}</td>
        <td>${outcome}</td>
        <td class="muted">${game.time_control}</td>
      `;

      /*
        Clicking a game:
        - Fill Info tab (metadata + PGN)
        - Call /api/analyze immediately to get fens+moves
        - initAnalysisUI renders board+move list
        - switch to Moves
      */
      tr.onclick = async () => {
        // Store PGN globally (future stockfish uses this)
        window.selectedGamePGN = game.pgn;

        // Fill the Info panel
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

        // Optional: show info while loading
        if (window.setActiveTab) window.setActiveTab("info");

        await yieldNextFrame();

        try {
          const result = await analyzeGameFromPGN(window.selectedGamePGN);
          if (!result) {
            alert("Failed to load game. Please try again.");
            return;
          }

          // Render analysis UI (board+move list+controls)
          if (typeof window.initAnalysisUI === "function") {
            window.initAnalysisUI(result);
          }

          // Switch to Moves tab after it's ready
          if (window.setActiveTab) window.setActiveTab("moves");

          // Enable bottom Analyze button (Stockfish later)
          enableBottomAnalyzeButton();
        } catch (err) {
          console.error("Error loading game analysis:", err);
          alert("An error occurred while loading the game.");
        }
      };

      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error fetching archive games:", error);
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