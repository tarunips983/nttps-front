console.log("✅ Smart Assistant UI loaded");

/* ===== GLOBAL HELPERS (ALWAYS AVAILABLE) ===== */

/* ===== GLOBAL CHAT HELPERS (REQUIRED) ===== */

window.addBotMessage = function (text) {
  const messages = document.getElementById("aiMessages");
  if (!messages) {
    console.warn("addBotMessage: aiMessages not found");
    return;
  }

  const div = document.createElement("div");
  div.className = "ai-msg ai-bot";
  div.innerHTML = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
};

window.addUserMessage = function (text) {
  const messages = document.getElementById("aiMessages");
  if (!messages) {
    console.warn("addUserMessage: aiMessages not found");
    return;
  }

  const div = document.createElement("div");
  div.className = "ai-msg ai-user";
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
};



window.bindSmartAssistantUI = function () {

  if (window.__SMART_ASSISTANT_BOUND__) {
    return;
  }

  const container = document.querySelector(".smart-assistant");
  const input = document.getElementById("aiInput");
  const sendBtn = document.getElementById("aiSendBtn");
  const messages = document.getElementById("aiMessages");

  if (!container || !input || !sendBtn || !messages) {
    console.warn("⚠️ Smart Assistant UI still not ready");
    return;
  }

  window.__SMART_ASSISTANT_BOUND__ = true;
  console.log("✅ Smart Assistant UI bound");

  function enterChatMode() {
    container.classList.remove("ai-welcome");
    messages.style.display = "block";
  }

  window.enterChatMode = enterChatMode;

  sendBtn.onclick = () => {
    if (window.handleAskAI) window.handleAskAI();
  };

  input.onkeydown = e => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      window.handleAskAI();
    }
  };
  if (window.loadChatHistory) {
    loadChatHistory().forEach(m => {
      m.role === "user"
        ? window.addUserMessage(m.text)
        : window.addBotMessage(m.text);
    });
  }

};



