// This is the button the user clicks after typing their username
const fetchGamesButton = document.getElementById("fetchGamesButton");
let currentUsername = "";
/*
  When the user clicks "Fetch Games":
  1. Read the username from the input box
  2. Build the API URL to fetch that user's archives
  3. Call fetchData() to talk to the backend
*/
fetchGamesButton.onclick = function handleFetchGamesClick() {
    currentUsername = document.getElementById("username").value.trim().toLowerCase();
    if(!currentUsername) {
        alert("Please enter a valid username.");
        return;
    }
    // This endpoint returns the list of archives for the user
    // Example: /api/chesscom/jahleel/archives
    const url = `/api/chesscom/${currentUsername}/archives`;
    fetchData(url);
};

async function fetchArchiveGames(username, archive) {
    const archiveUrl = `/api/chesscom/${username}/games?archive=${archive}`;

    try {
        const response = await fetch(archiveUrl);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const gamesDiv = document.getElementById("games");
        gamesDiv.innerHTML = "";

        data.games.forEach(game => {
          let outcome = "Draw";
          if (game.white.result === "win") {
              outcome = "White Wins";
          } else if (game.black.result === "win") {
              outcome = "Black Wins";
          }

          const gameButton = document.createElement('button');
          gameButton.innerText = `${game.white.username} (W) vs ${game.black.username} (B) - ${outcome}`;
        
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
                  `;
                  document.getElementById("pgnBox").innerText = game.pgn;
                  postData({ pgn: game.pgn });
          }
          gamesDiv.appendChild(gameButton);
        });
    } catch (error) {
        console.error("Error fetching archive games:", error);
    }
}

/*
  fetchData is a generic async function that:
  - Sends an HTTP request to the backend
  - Waits for the response
  - Converts the response into JSON
  - Updates the DOM based on the returned data
*/
async function fetchData(url) {
  try {
    // Send a GET request to the backend
    const response = await fetch(url);
    // If the backend returns an error status (404, 500, etc.)
    // we manually throw an error so it goes to the catch block
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    // Convert the JSON response body into a JavaScript object
    const data = await response.json();
    // Get the <div> where we will display archive buttons
    const archivesDiv = document.getElementById("archives");

    
    // Clear any previously displayed archives
    // (important when fetching a new username)
    archivesDiv.innerHTML = "";

    /*
      Loop through each archive returned by the backend.
      data.archives is an array like:
      ["dummy-archive-for-jahleel"]
    */
    data.archives.forEach(archive => {
        // Create a button for this archive
        const archiveButton = document.createElement('button');
        // Show the archive name on the button
        const archiveSegments = archive.split('/');
        const archiveMonth = archiveSegments.at(-1);
        const archiveYear = archiveSegments.at(-2);
        const archiveParam = `${archiveYear}/${archiveMonth}`;
        
        archiveButton.innerText = `Archive: ${archiveMonth} / ${archiveYear}`;

        /*
          When this archive button is clicked:
          Call fetchArchiveGames() to get the games in this archive
        */
        archiveButton.onclick = () => fetchArchiveGames(currentUsername, archiveParam);
        // Add the button to the page
        archivesDiv.appendChild(archiveButton);
    });

  } catch (error) {
    // Any network or parsing errors end up here
    console.error("Error fetching data:", error);
  }

}

async function postData(data = {}) {
    const postURL = "/api/analyze";
    try{
      const response = await fetch(postURL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      if(response.ok) {
        const result = await response.json();
        console.log("Analysis result:", result);
      }
    } catch (error) {
      console.error("Error posting data:", error);
    }
  }