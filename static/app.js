/*
  app.js
  ------
  Frontend entry-point wiring + route-based SPA navigation.

  Routes:
  /                  -> landing
  /:username/games   -> archives/games browse page
  /:username/analysis -> analysis view, only restorable if PGN exists in history state
*/

const fetchGamesButton = document.getElementById("fetchGamesButton");
const usernameInput = document.getElementById("username");
const usernameForm = document.getElementById("usernameForm");

const heroUsernameInput = document.getElementById("heroUsername");
const heroUsernameForm = document.getElementById("heroUsernameForm");
const topbarTitle = document.getElementById("topbarTitle");

window.currentUsername = "";
window.currentUsernameDisplay = "";
window.hasExitedHero = false;
window.currentView = "landing";

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function getDisplayUsername(value) {
  return String(value || "").trim();
}

function syncInputs(rawUsername) {
  const value = rawUsername || "";
  if (usernameInput) usernameInput.value = value;
  if (heroUsernameInput) heroUsernameInput.value = value;
}

/* ---------------------------
   History state builders
---------------------------- */

function buildLandingState() {
  return { view: "landing" };
}

function buildBrowseState() {
  return {
    view: "browse",
    username: window.currentUsername || "",
    displayUsername:
      window.currentUsernameDisplay || window.currentUsername || "",
  };
}

function buildAnalysisState() {
  const analysisDiv = document.getElementById("analysis");

  return {
    view: "analysis",
    username: window.currentUsername || "",
    displayUsername:
      window.currentUsernameDisplay || window.currentUsername || "",
    gameId: window.currentGameId || null,
    pgn: window.selectedGamePGN || null,
    gameMeta: window.currentGameMeta || null,
    analysisHtml: analysisDiv ? analysisDiv.innerHTML : "",
  };
}

/* ---------------------------
   Route builders
---------------------------- */

function buildBrowsePath() {
  if (!window.currentUsername) return "/";
  return `/${encodeURIComponent(window.currentUsername)}/games`;
}

function buildAnalysisPath() {
  if (!window.currentUsername) return "/";

  if (window.currentGameId) {
    return `/${encodeURIComponent(window.currentUsername)}/analysis/${encodeURIComponent(window.currentGameId)}`;
  }

  return `/${encodeURIComponent(window.currentUsername)}/analysis`;
}

window.pushBrowseHistory = function pushBrowseHistory() {
  history.pushState(buildBrowseState(), "", buildBrowsePath());
};

window.pushAnalysisHistory = function pushAnalysisHistory() {
  history.pushState(buildAnalysisState(), "", buildAnalysisPath());
};

/* ---------------------------
   Parse URL -> app state
---------------------------- */

function parsePathToState() {
  const path = window.location.pathname;

  if (path === "/" || path === "") {
    return buildLandingState();
  }

  const parts = path.split("/").filter(Boolean);

  // /hikaru/analysis/123456789
  if (parts.length === 3 && parts[1] === "analysis") {
    const username = decodeURIComponent(parts[0]);
    const gameId = decodeURIComponent(parts[2]);

    return {
      view: "analysis",
      username,
      displayUsername: username,
      gameId,
      pgn: null,
      gameMeta: null,
      analysisHtml: "",
    };
  }

  // /hikaru/analysis
  // Note: this can only fully restore if history.state has PGN.
  if (parts.length === 2 && parts[1] === "analysis") {
    const username = decodeURIComponent(parts[0]);

    return {
      view: "analysis",
      username,
      displayUsername: username,
      pgn: null,
      gameMeta: null,
      analysisHtml: "",
    };
  }

  return buildLandingState();
}

/* ---------------------------
   Apply app state
---------------------------- */

async function applyAppState(state) {
  const nextState = state || buildLandingState();
  window.currentView = nextState.view || "landing";

  if (nextState.view === "landing") {
    if (typeof window.clearAnalysisState === "function") {
      window.clearAnalysisState();
    }

    if (typeof window.showLandingMode === "function") {
      window.showLandingMode();
    }

    syncInputs("");
    return;
  }

  if (nextState.username) {
    window.currentUsername = normalizeUsername(nextState.username);
  }

  if (nextState.displayUsername || nextState.username) {
    window.currentUsernameDisplay =
      nextState.displayUsername || nextState.username;
  }

  syncInputs(window.currentUsernameDisplay || window.currentUsername);

  if (nextState.view === "browse") {
    if (typeof window.clearAnalysisState === "function") {
      window.clearAnalysisState();
    }

    if (typeof window.showBrowseMode === "function") {
      window.showBrowseMode();
    }

    const url = `/api/chesscom/${window.currentUsername}/archives`;

    if (window._lastFetchedArchiveUrl !== url) {
      await window.fetchData(url, { pushHistory: false });
    }

    return;
  }

  if (nextState.view === "analysis") {
    if (nextState.gameId && !nextState.pgn) {
      if (typeof window.beginLoading === "function") {
        window.beginLoading("Loading game...");
      }

      try {
        const response = await fetch(
          `/api/chesscom/${window.currentUsername}/game/${nextState.gameId}`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const payload = await response.json();

        if (payload.game && typeof window.loadGameIntoAnalysis === "function") {
          await window.loadGameIntoAnalysis(payload.game, {
            pushHistory: false,
            keepLoading: true
          });
          return;
        }

        throw new Error("Game payload missing.");
      } catch (err) {
        console.error("Failed to load game from route:", err);
        alert("Could not load that game.");

        if (typeof window.showBrowseMode === "function") {
          window.showBrowseMode();
        }
      } finally {
        if (typeof window.endLoading === "function") {
          window.endLoading();
        }
      }

      return;
    }
    if (!nextState.pgn) {
      if (typeof window.showBrowseMode === "function") {
        window.showBrowseMode();
      }

      const url = `/api/chesscom/${window.currentUsername}/archives`;
      if (window._lastFetchedArchiveUrl !== url) {
        await window.fetchData(url, { pushHistory: false });
      }

      return;
    }

    window.selectedGamePGN = nextState.pgn;
    window.currentGameMeta = nextState.gameMeta || null;

    if (typeof window.showAnalysisMode === "function") {
      window.showAnalysisMode();
    }

    const analysisDiv = document.getElementById("analysis");
    if (analysisDiv && nextState.analysisHtml) {
      analysisDiv.innerHTML = nextState.analysisHtml;
    }

    const result = await window.postData({ pgn: nextState.pgn });

    if (result && typeof window.initAnalysisUI === "function") {
      window.initAnalysisUI(result);
    } else if (typeof window.showBrowseMode === "function") {
      window.showBrowseMode();
    }
  }
}

/* ---------------------------
   Search handling
---------------------------- */

function isAnalysisViewOpen() {
  const analysisLayout = document.getElementById("analysisLayout");
  if (!analysisLayout) return false;
  return window.getComputedStyle(analysisLayout).display !== "none";
}

async function handleUsernameSearch(rawValue) {
  const rawUsername = getDisplayUsername(rawValue);
  const nextUsername = normalizeUsername(rawUsername);

  if (!nextUsername) {
    alert("Please enter a valid username.");
    return;
  }

  const currentUsername = normalizeUsername(window.currentUsername);

  if (
    isAnalysisViewOpen() &&
    currentUsername &&
    nextUsername !== currentUsername
  ) {
    const confirmed = window.confirm(
      "Are you sure you want to exit analysis and search for a different username?"
    );

    if (!confirmed) return;

    if (typeof window.clearAnalysisState === "function") {
      window.clearAnalysisState();
    }

    if (typeof window.showBrowseMode === "function") {
      window.showBrowseMode();
    }
  }

  window.currentUsername = nextUsername;
  window.currentUsernameDisplay = rawUsername;
  syncInputs(rawUsername);

  window._lastFetchedArchiveUrl = null;

  const url = `/api/chesscom/${nextUsername}/archives`;
  await window.fetchData(url, { pushHistory: true });
}

/* ---------------------------
   Event wiring
---------------------------- */

if (fetchGamesButton) {
  fetchGamesButton.onclick = function () {
    handleUsernameSearch(usernameInput.value);
  };
}

if (usernameForm) {
  usernameForm.addEventListener("submit", function (e) {
    e.preventDefault();
    handleUsernameSearch(usernameInput.value);
  });
}

if (heroUsernameForm) {
  heroUsernameForm.addEventListener("submit", function (e) {
    e.preventDefault();
    handleUsernameSearch(heroUsernameInput.value);
  });
}

if (topbarTitle) {
  topbarTitle.addEventListener("click", async function () {
    history.pushState(buildLandingState(), "", "/");
    await applyAppState(buildLandingState());
  });
}

window.addEventListener("popstate", function (event) {
  applyAppState(event.state || parsePathToState());
});

/* ---------------------------
   Startup
---------------------------- */

const initialState = history.state || parsePathToState();
history.replaceState(initialState, "", window.location.pathname);
applyAppState(initialState);