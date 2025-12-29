console.log("✅ Smart Assistant UI loaded");

document.addEventListener("DOMContentLoaded", () => {

  const container = document.querySelector(".smart-assistant");
  const input = document.getElementById("aiChatInput");
  const sendBtn =
    document.getElementById("aiSendBtn") ||
    document.querySelector("button");
  const messages = document.getElementById("aiMessages");

  if (!container || !input || !sendBtn || !messages) {
    console.warn("⚠️ Smart Assistant UI not ready");
    return;
  }

  // ================= UI STATE =================
  function enterChatMode() {
    container.classList.remove("ai-welcome");
    messages.style.display = "block";
    messages.scrollTop = messages.scrollHeight;
  }

  // ================= CHAT MESSAGE HELPERS =================
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

    if (typeof saveChatMessage === "function") {
      saveChatMessage("bot", div.innerText);
    }
  }

  // ================= SEND EVENTS =================
  sendBtn.addEventListener("click", () => {
    if (typeof window.handleAskAI === "function") {
      window.handleAskAI();
    } else {
      console.error("❌ handleAskAI not found");
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      window.handleAskAI();
    }
  });

  // ================= LOAD CHAT HISTORY =================
  if (typeof loadChatHistory === "function") {
    const history = loadChatHistory();
    history.forEach(m => {
      if (m.role === "user") addUserMessage(m.text);
      else addBotMessage(m.text);
    });
  }

  // ================= EXPOSE GLOBALLY =================
  window.addUserMessage = addUserMessage;
  window.addBotMessage = addBotMessage;
  window.enterChatMode = enterChatMode;
});
