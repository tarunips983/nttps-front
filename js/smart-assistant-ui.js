// smart-assistant-ui.js
// UI layer ONLY – no AI logic, no backend analyze calls
// smart-assistant-ui.js
console.log("Smart Assistant UI loaded");

// ================================
// SMART ASSISTANT UI (GLOBAL)
// ================================
document.getElementById("aiAnalyzeBtn")
  .addEventListener("click", onAnalyzeClick);

function onAnalyzeClick() {
  if (typeof window.analyzeAI !== "function") {
    alert("Smart Assistant not ready yet");
    return;
  }
  window.analyzeAI();
}


window.saveAIData = function () {
    if (typeof window._saveAICore !== "function") {
        alert("AI core not loaded");
        return;
    }

    window._saveAICore();
};

