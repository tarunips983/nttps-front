console.log("✅ Smart Assistant UI loaded");

// ================== GLOBAL INPUT STORAGE ==================
window.__LAST_AI_INPUT__ = "";

// ================== DOM READY ==================
document.addEventListener("DOMContentLoaded", () => {
  const analyzeBtn = document.getElementById("aiAnalyzeBtn");
  const saveBtn = document.getElementById("aiSaveBtn");
  const input = document.getElementById("aiInput");

  if (!analyzeBtn || !input) {
    console.warn("⚠️ Smart Assistant UI not ready");
    return;
  }

  // ---------- ANALYZE ----------
  analyzeBtn.addEventListener("click", () => {
    const text = input.value.trim();
    if (!text) {
      showToast("Please enter text", "error");
      return;
    }

    // ✅ STORE INPUT FOR CORE
    window.__LAST_AI_INPUT__ = text;

    // clear input AFTER storing
    input.value = "";

    // switch layout to chat mode
    const wrapper = document.getElementById("aiChatWrapper");
    if (wrapper) {
      wrapper.classList.remove("center");
      wrapper.classList.add("chat");
    }

    // show user message
    addUserMessage(text);

    // show analyzing message
    addBotMessage("Analyzing…");

    if (typeof window.analyzeAI !== "function") {
      showToast("AI core not loaded", "error");
      return;
    }
window.analyzeAI();

  });

  // ---------- SAVE ----------
  if (saveBtn) {
    saveBtn.addEventListener("click", () => {
      if (typeof window.saveAIData !== "function") {
        showToast("Save function not ready", "error");
        return;
      }
      window.saveAIData();
    });
  }
});

// ================== CHAT HELPERS ==================
function addUserMessage(text) {
  const box = document.getElementById("aiChatMessages");
  if (!box) return;

  box.insertAdjacentHTML(
    "beforeend",
    `<div class="ai-msg user">${escapeHtml(text)}</div>`
  );

  box.scrollTop = box.scrollHeight;
}

function addBotMessage(html) {
  const box = document.getElementById("aiChatMessages");
  if (!box) return;

  box.insertAdjacentHTML(
    "beforeend",
    `<div class="ai-msg bot">${html}</div>`
  );

  box.scrollTop = box.scrollHeight;
}

// ================== TOAST ==================
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

// ================== SAFE HTML ==================
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
