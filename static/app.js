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

const heroSection = document.getElementById("heroSection");
const heroUsernameInput = document.getElementById("heroUsername");
const heroUsernameForm = document.getElementById("heroUsernameForm");

const browseLayout = document.getElementById("browseLayout");

window.currentUsername = "";
window.currentUsernameDisplay = "";
window.hasExitedHero = false;

function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

function getDisplayUsername(value) {
  return String(value || "").trim();
}

function isAnalysisViewOpen() {
  const analysisLayout = document.getElementById("analysisLayout");
  if (!analysisLayout) return false;
  return window.getComputedStyle(analysisLayout).display !== "none";
}

function cleanBrowserURL() {
  history.replaceState({}, "", "/");
}

function hideHeroSection() {
  if (!heroSection || window.hasExitedHero) return;

  heroSection.classList.add("hidden");
  if (browseLayout) browseLayout.classList.remove("preHero");
  window.hasExitedHero = true;
}

function syncInputs(rawUsername) {
  if (usernameInput) usernameInput.value = rawUsername;
  if (heroUsernameInput) heroUsernameInput.value = rawUsername;
}

function handleUsernameSearch(rawValue) {
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
  cleanBrowserURL();
  hideHeroSection();

  window._lastFetchedArchiveUrl = null;

  const url = `/api/chesscom/${nextUsername}/archives`;
  window.fetchData(url);
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

if (browseLayout) {
  browseLayout.classList.add("preHero");
}

cleanBrowserURL();
