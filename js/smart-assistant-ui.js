console.log("✅ Smart Assistant UI loaded");

// ================== GLOBAL INPUT STORAGE ==================
window.__LAST_AI_INPUT__ = "";

// ================== DOM READY ==================
document.addEventListener("DOMContentLoaded", () => {

  const chatInput = document.getElementById("aiChatInput");
  const chatBox = document.getElementById("aiChatMessages");
  const wrapper = document.getElementById("aiChatWrapper");

  if (!chatInput || !chatBox) {
    console.warn("⚠️ Smart Assistant UI not ready");
    return;
  }

  console.log("✅ Smart Assistant UI ready (chat mode)");

  // ---------- ASK HANDLER ----------
  window.handleAskAI = async function () {
    const text = chatInput.value.trim();
    if (!text) return;

    // store input
    window.__LAST_AI_INPUT__ = text;

    // show chat area
    wrapper.classList.remove("center");
    wrapper.classList.add("chat");

    // show user message
    addUserMessage(text);
    saveChatMessage("user", text);

    chatInput.value = "";

    // typing indicator
    const typingId = "typing-" + Date.now();
    addBotMessage(`<span id="${typingId}">Typing…</span>`);

    try {
      if (typeof window.askAIQuestion === "function") {
        await window.askAIQuestion(text);
      } else if (typeof window.analyzeAI === "function") {
        await window.analyzeAI(text);
      } else {
        addBotMessage("AI engine not available.");
      }
    } catch (err) {
      console.error(err);
      addBotMessage("❌ Error while processing your request.");
    } finally {
      document.getElementById(typingId)?.remove();
    }
  };

  // ---------- ENTER KEY ----------
  chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      window.handleAskAI();
    }
  });

  // ---------- LOAD CHAT HISTORY ----------
  const history = loadChatHistory();
  history.forEach(m => {
    if (m.role === "user") addUserMessage(m.text);
    else addBotMessage(m.text);
  });

  if (history.length) {
    wrapper.classList.remove("center");
    wrapper.classList.add("chat");
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

// ================== STORAGE ==================
const CHAT_KEY = "smartChatHistory";

function saveChatMessage(role, text) {
  const history = JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
  history.push({ role, text, time: Date.now() });
  localStorage.setItem(CHAT_KEY, JSON.stringify(history));
}

function loadChatHistory() {
  return JSON.parse(localStorage.getItem(CHAT_KEY) || "[]");
}

// ================== SAFE HTML ==================
function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
