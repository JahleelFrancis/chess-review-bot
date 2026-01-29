// This is the button the user clicks after typing their username
const fetchGamesButton = document.getElementById("fetchGamesButton");
window.currentUsername = "";
/*
  When the user clicks "Fetch Games":
  1. Read the username from the input box
  2. Build the API URL to fetch that user's archives
  3. Call fetchData() to talk to the backend
*/
fetchGamesButton.onclick = function handleFetchGamesClick() {
    currentUsername = document.getElementById("username").value.trim().toLowerCase();
    window.currentUsername = currentUsername;
    if(!currentUsername) {
        alert("Please enter a valid username.");
        return;
    }
    // This endpoint returns the list of archives for the user
    // Example: /api/chesscom/jahleel/archives
    const url = `/api/chesscom/${currentUsername}/archives`;
    window.fetchData(url);
};

