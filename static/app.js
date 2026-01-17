const fetchGamesButton = document.getElementById("fetchGamesButton");

fetchGamesButton.onclick = function handleFetchGamesClick(){
    const username = document.getElementById("username").value;
    const url = `/api/chesscom/${username}/archives`;
    fetchData(url);
}

async function fetchData(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    const archivesDiv = document.getElementById("archives");
    archivesDiv.innerHTML = "";

    data.archives.forEach(archive => {
        const archiveButton = document.createElement('button');
        archiveButton.innerText = `${archive}`;
        archiveButton.onclick = function handleArchiveButtonClick(){
            alert('button clicked');
        }
        archivesDiv.appendChild(archiveButton);
    });

  } catch (error) {
    console.error("Error fetching data:", error);
  }
}
