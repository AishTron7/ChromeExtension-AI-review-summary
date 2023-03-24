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
            loadingElement.classList.add("hidden");
  
            if (chrome.runtime.lastError) {
              summaryElement.innerHTML = "An error occurred.";
            } else {
              const points = response.summary.split("\n");
              points.forEach((point) => {
                const pointElement = document.createElement("div");
                pointElement.textContent = point;
                pointElement.className = "summary-point";
                summaryElement.appendChild(pointElement);
              });
            }
          }
        );
      });
    });
  });
  