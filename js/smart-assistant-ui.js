console.log("✅ Smart Assistant UI loaded");

document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("aiAnalyzeBtn");
  const saveBtn = document.getElementById("aiSaveBtn");

  if (!analyzeBtn) {
    console.warn("⚠️ aiAnalyzeBtn not found (UI not visible yet)");
    return;
  }

  analyzeBtn.addEventListener("click", () => {
    if (typeof window.analyzeAI !== "function") {
      alert("Smart Assistant core not loaded yet");
      return;
    }
    window.analyzeAI();
  });

  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (typeof window.saveAIData !== "function") {
        alert("Save function not ready");
        return;
      }
      window.saveAIData();
    });
  }
});
