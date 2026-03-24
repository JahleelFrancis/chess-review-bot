/*
  api.js
  ------
  Backend/API + DOM rendering helpers.
*/

window._loadingCount = 0;

window.beginLoading = function beginLoading(message = "Loading...") {
  const overlay = document.getElementById("loadingOverlay");
  const text = document.getElementById("loadingText");

  window._loadingCount = (window._loadingCount || 0) + 1;

  if (text) text.innerText = message;
  if (overlay) {
    overlay.classList.add("active");
    overlay.setAttribute("aria-hidden", "false");
  }
};

window.endLoading = function endLoading() {
  const overlay = document.getElementById("loadingOverlay");

  window._loadingCount = Math.max(0, (window._loadingCount || 0) - 1);

  if (window._loadingCount === 0 && overlay) {
    overlay.classList.remove("active");
    overlay.setAttribute("aria-hidden", "true");
  }
};

async function yieldNextFrame() {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

async function analyzeGameFromPGN(pgn) {
  const analysisResult = await window.postData({ pgn });
  console.log("Analysis result:", analysisResult);
  return analysisResult;
}

function formatUsernameLabel(username) {
  if (!username) return "Archives";

  const trimmed = String(username).trim();
  if (!trimmed) return "Archives";

  const lastChar = trimmed.slice(-1).toLowerCase();
  const possessive = lastChar === "s" ? "'" : "'s";

  return `${trimmed}${possessive} Archives`;
}

function updateArchivesHeader() {
  const archivesHeader = document.getElementById("archivesHeader");
  if (!archivesHeader) return;

  archivesHeader.innerText = formatUsernameLabel(
    window.currentUsernameDisplay || window.currentUsername
  );
}

function updateGamesHeader(archive) {
  const gamesHeader = document.getElementById("gamesHeader");
  if (!gamesHeader) return;

  const displayName = window.currentUsernameDisplay || window.currentUsername;

  if (archive) {
    gamesHeader.innerText = `${displayName} • Games (${archive})`;
  } else {
    gamesHeader.innerText = "Games";
  }
}

window.fetchData = async function fetchData(url, options = {}) {
  if (window._lastFetchedArchiveUrl === url) return;

  window.beginLoading("Fetching archives...");

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();
    window._lastFetchedArchiveUrl = url;

    const archivesDiv = document.getElementById("archives");
    const gamesPanel = document.getElementById("gamesPanel");
    const gamesDiv = document.getElementById("games");

    if (data.username) {
      window.currentUsernameDisplay = data.username;
    }

    if (typeof window.showBrowseMode === "function") {
      window.showBrowseMode();
    }

    if (gamesPanel) gamesPanel.classList.add("hidden");
    if (gamesDiv) gamesDiv.innerHTML = "";
    updateGamesHeader(null);
    updateArchivesHeader();

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

    const archiveList = Array.isArray(data.archives)
      ? [...data.archives].reverse()
      : [];

    archiveList.forEach((archiveUrl) => {
      const segs = archiveUrl.split("/");
      const month = segs.at(-1);
      const year = segs.at(-2);
      const archiveParam = `${year}/${month}`;

      const tr = document.createElement("tr");
      tr.className = "dataRow";
      tr.dataset.archive = archiveParam;

      tr.innerHTML = `
        <td>${month} / ${year}</td>
        <td class="muted" data-count="true">—</td>
      `;

      tr.onclick = () => {
        tbody
          .querySelectorAll(".dataRow.active")
          .forEach((r) => r.classList.remove("active"));

        tr.classList.add("active");
        window.fetchArchiveGames(window.currentUsername, archiveParam);
      };

      tbody.appendChild(tr);
    });

    if (options.pushHistory !== false && typeof window.pushBrowseHistory === "function") {
      window.pushBrowseHistory();
    }
  } catch (error) {
    console.error("Error fetching data:", error);
  } finally {
    window.endLoading();
  }
};

window.fetchArchiveGames = async function fetchArchiveGames(username, archive) {
  const archiveUrl = `/api/chesscom/${username}/games?archive=${archive}`;

  window.beginLoading("Fetching games...");

  try {
    const response = await fetch(archiveUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

    const data = await response.json();

    const gamesPanel = document.getElementById("gamesPanel");
    const gamesHeader = document.getElementById("gamesHeader");
    const gamesDiv = document.getElementById("games");

    if (gamesPanel) gamesPanel.classList.remove("hidden");
    if (gamesHeader) {
      gamesHeader.innerText = `${window.currentUsernameDisplay || username} • Games (${archive})`;
    }

    const row = document.querySelector(`tr.dataRow[data-archive="${archive}"]`);
    if (row) {
      const countCell = row.querySelector(`td[data-count="true"]`);
      if (countCell) countCell.innerText = String(data.games.length);
    }

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

      tr.onclick = async () => {
        window.beginLoading("Loading analysis...");

        try {
          window.selectedGamePGN = game.pgn;
          window.currentGameMeta = {
            whiteUsername: game.white.username,
            whiteRating: game.white.rating,
            blackUsername: game.black.username,
            blackRating: game.black.rating,
          };

          const analysisDiv = document.getElementById("analysis");
          if (analysisDiv) {
            analysisDiv.innerHTML = `
              <h3>Game Analysis</h3>
              <p><strong>White:</strong> ${game.white.username} (${game.white.rating})</p>
              <p><strong>Black:</strong> ${game.black.username} (${game.black.rating})</p>
              <p><strong>Result:</strong> ${outcome}</p>
              <p><strong>Time Control:</strong> ${game.time_control}</p>
              <p><strong>Date:</strong> ${new Date(game.end_time * 1000).toLocaleDateString()}</p>
              <p><a href="${game.url}" target="_blank">View on Chess.com</a></p>

              <h3>Engine</h3>
              <p id="currentEvalText"><strong>Eval:</strong> Loading...</p>
              <p id="bestMoveText"><strong>Best move:</strong> Loading...</p>

              <details class="pgnDetails">
                <summary>Show PGN</summary>
                <pre id="pgnBox" class="pgnBox"></pre>
              </details>
            `;
            const pgnBox = document.getElementById("pgnBox");
            if (pgnBox) pgnBox.innerText = game.pgn;
          }

          if (window.setActiveTab) window.setActiveTab("info");
          await yieldNextFrame();

          const result = await analyzeGameFromPGN(window.selectedGamePGN);
          if (!result) {
            alert("Failed to load game. Please try again.");
            return;
          }

          if (typeof window.initAnalysisUI === "function") {
            window.initAnalysisUI(result);
          }

          if (typeof window.pushAnalysisHistory === "function") {
            window.pushAnalysisHistory();
          }
        } catch (err) {
          console.error("Error loading game analysis:", err);
          alert("An error occurred while loading the game.");
        } finally {
          window.endLoading();
        }
      };

      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error fetching archive games:", error);
  } finally {
    window.endLoading();
  }
};

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