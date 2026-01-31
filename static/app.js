/*
  app.js
  ------
  "Entry point" wiring for the frontend.

  - Reads the Chess.com username from the landing input.
  - Stores the active username on window.currentUsername so other scripts can use it.
  - Kicks off the backend request to fetch that user's monthly archives.

  Note: We're using multiple script tags (no bundler), so sharing state/functions via window.*
  is intentional for now.
*/

// This is the button the user clicks after typing their username
const fetchGamesButton = document.getElementById("fetchGamesButton");

// Shared state across scripts (api.js uses this when an archive button is clicked)
window.currentUsername = "";

/*
  When the user clicks "Fetch Games":
  1) Read the username from the input box
  2) Normalize it (trim + lowercase)
  3) Save it to window.currentUsername for other scripts
  4) Build the backend URL for archives
  5) Call fetchData() (defined in api.js) to render the archive buttons
*/
fetchGamesButton.onclick = function handleFetchGamesClick() {
    currentUsername = document.getElementById("username").value.trim().toLowerCase();
    window.currentUsername = currentUsername;

    if(!currentUsername) {
        alert("Please enter a valid username.");
        return;
    }

    // Backend endpoint that returns the list of archive months for the user
    // Example: /api/chesscom/jahleel/archives
    const url = `/api/chesscom/${currentUsername}/archives`;

    // fetchData() is defined in api.js and attached to window
    window.fetchData(url);
};
