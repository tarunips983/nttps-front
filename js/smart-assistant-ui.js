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


function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.textContent = message;

  toast.style.position = "fixed";
  toast.style.bottom = "20px";
  toast.style.right = "20px";
  toast.style.padding = "10px 14px";
  toast.style.borderRadius = "8px";
  toast.style.fontWeight = "600";
  toast.style.color = "#fff";
  toast.style.zIndex = "9999";
  toast.style.background =
    type === "success" ? "#16a34a" :
    type === "error" ? "#dc2626" :
    "#2563eb";

  document.body.appendChild(toast);

  setTimeout(() => toast.remove(), 2500);
}
