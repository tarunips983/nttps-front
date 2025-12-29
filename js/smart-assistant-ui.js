console.log("✅ Smart Assistant UI loaded");

document.addEventListener("DOMContentLoaded", () => {

  const container = document.querySelector(".smart-assistant");
  const input = document.getElementById("aiInput");
  const sendBtn = document.getElementById("aiSendBtn");
  const messages = document.getElementById("aiMessages");

  if (!container || !input || !sendBtn || !messages) {
    console.warn("⚠️ Smart Assistant UI not ready");
    return;
  }

  // ===== UI STATE =====
  function enterChatMode() {
    container.classList.remove("ai-welcome");
    messages.style.display = "block";
    messages.scrollTop = messages.scrollHeight;
  }

  // ===== CHAT HELPERS =====
  function addUserMessage(text) {
    enterChatMode();
    const div = document.createElement("div");
    div.className = "ai-msg ai-user";
    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function addBotMessage(text) {
    enterChatMode();
    const div = document.createElement("div");
    div.className = "ai-msg ai-bot";
    div.innerHTML = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    if (window.saveChatMessage) {
      saveChatMessage("bot", div.innerText);
    }
  }

  // ===== EVENTS =====
  sendBtn.addEventListener("click", () => {
    if (window.handleAskAI) window.handleAskAI();
  });

  input.addEventListener("keydown", e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      window.handleAskAI();
    }
  });

  // ===== LOAD HISTORY =====
  if (window.loadChatHistory) {
    loadChatHistory().forEach(m => {
      m.role === "user" ? addUserMessage(m.text) : addBotMessage(m.text);
    });
  }

  // ===== EXPOSE =====
  window.addUserMessage = addUserMessage;
  window.addBotMessage = addBotMessage;
  window.enterChatMode = enterChatMode;
});
