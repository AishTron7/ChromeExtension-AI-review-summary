document.addEventListener("DOMContentLoaded", () => {
  const generateSummaryButton = document.getElementById("generateSummary");
  const summaryElement = document.getElementById("summary");
  const loadingElement = document.getElementById("loading");

  generateSummaryButton.addEventListener("click", async () => {
    summaryElement.innerHTML = "";
    loadingElement.classList.remove("hidden");

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const activeTab = tabs[0];
      chrome.tabs.sendMessage(
        activeTab.id,
        { message: "generate_summary" },
        (response) => {
          if (chrome.runtime.lastError) {
            // Show the loading screen instead of displaying an error message
            loadingElement.classList.remove("hidden");
          } else if (response && response.summary) {
            displaySummary(response.summary);
          } else {
            // Handle any other scenario, still showing the loading screen
            loadingElement.classList.remove("hidden");
          }
        }
      );
    });
  });

  // Add this listener for receiving summary from the content script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "send_summary") {
      displaySummary(message.summary);
    }
  });

  // Function to display summary
  function displaySummary(summary) {
    summaryElement.innerHTML = ""; // Clear existing content

    const points = summary.split("\n");
    points.forEach((point) => {
      const pointElement = document.createElement("div");
      pointElement.textContent = point;
      pointElement.className = "summary-point";
      summaryElement.appendChild(pointElement);
    });

    loadingElement.classList.add("hidden"); // Hide loading element
  }
});
