// smart-assistant-ui.js
// UI layer ONLY – no AI logic, no backend analyze calls

window.analyzeAI = function () {
    const text = document.getElementById("aiInput").value.trim();
    if (!text) {
        alert("Enter text");
        return;
    }

    // ✅ Call AI CORE directly (frontend brain)
    if (typeof window.detectModuleSmart !== "function") {
        alert("AI core not loaded");
        return;
    }

    // Core analyze function
    window._analyzeCore(text);
};

window.saveAIData = function () {
    if (typeof window._saveAICore !== "function") {
        alert("AI core not loaded");
        return;
    }
    window._saveAICore();
};
