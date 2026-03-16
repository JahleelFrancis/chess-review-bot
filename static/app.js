/*
  app.js
  ------
  Frontend entry-point wiring.

  Handles:
  - Fetch button click
  - Enter key / form submit
  - Confirming before leaving analysis for a different username
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

function buildLandingState() {
  return { view: "landing" };
}

function buildBrowseState() {
  return {
    view: "browse",
    username: window.currentUsername || "",
    displayUsername: window.currentUsernameDisplay || window.currentUsername || "",
  };
}

function buildAnalysisState() {
  const analysisDiv = document.getElementById("analysis");

  return {
    view: "analysis",
    username: window.currentUsername || "",
    displayUsername: window.currentUsernameDisplay || window.currentUsername || "",
    pgn: window.selectedGamePGN || null,
    gameMeta: window.currentGameMeta || null,
    analysisHtml: analysisDiv ? analysisDiv.innerHTML : "",
  };
}

window.pushBrowseHistory = function pushBrowseHistory() {
  history.pushState(buildBrowseState(), "", "");
};

window.pushAnalysisHistory = function pushAnalysisHistory() {
  history.pushState(buildAnalysisState(), "", "");
};

async function applyAppState(state) {
  const nextState = state || buildLandingState();
  window.currentView = nextState.view || "landing";

  // If going back to landing, clear analysis state and show landing mode
  if (nextState.view === "landing") {
    if (typeof window.clearAnalysisState === "function") {
      window.clearAnalysisState();
    }
    if (typeof window.showLandingMode === "function") {
      window.showLandingMode();
    }
    return;
  }

  if (nextState.username) {
    window.currentUsername = normalizeUsername(nextState.username);
  }

  if (nextState.displayUsername || nextState.username) {
    window.currentUsernameDisplay = nextState.displayUsername || nextState.username;
  }

  syncInputs(window.currentUsernameDisplay || window.currentUsername); // Keep input fields in sync with state

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
    if (!nextState.pgn) {
      if (typeof window.showBrowseMode === "function") {
        window.showBrowseMode();
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

    if (!confirmed) {
      return;
    }

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
    history.pushState(buildLandingState(), "", "");
    await applyAppState(buildLandingState());
  });
}

window.addEventListener("popstate", function (event) {
  applyAppState(event.state);
});

history.replaceState(buildLandingState(), "", "");
applyAppState(buildLandingState());
