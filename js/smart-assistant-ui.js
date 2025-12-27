// smart-assistant-ui.js
// UI layer ONLY – no AI logic, no backend analyze calls
// smart-assistant-ui.js
console.log("Smart Assistant UI loaded");

// ================================
// SMART ASSISTANT UI (GLOBAL)
// ================================

window.analyzeAI = function () {
    console.log("Analyze clicked");

    if (typeof window._analyzeCore !== "function") {
        alert("AI core not loaded");
        console.error("_analyzeCore missing");
        return;
    }

    window._analyzeCore();
};

window.saveAIData = function () {
    if (typeof window._saveAICore !== "function") {
        alert("AI core not loaded");
        return;
    }

    window._saveAICore();
};

