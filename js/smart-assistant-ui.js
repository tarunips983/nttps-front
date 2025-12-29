console.log("✅ Smart Assistant UI loaded");

document.addEventListener("DOMContentLoaded", () => {

  const container = document.getElementById("smart-assistant-container");


  const input =
  document.getElementById("aiInput") ||
  document.getElementById("aiChatInput") ||
  document.querySelector("textarea");

const sendBtn =
  document.getElementById("aiSendBtn") ||
  document.querySelector("button");

const messages =
  document.getElementById("aiMessages");


  if (!input || !sendBtn || !messages) {
    console.warn("⚠️ Smart Assistant UI not ready");
    return;
  }
  
  // ================= CHAT MESSAGE HELPERS =================

function addUserMessage(text) {
  const messages = document.getElementById("aiMessages");
  if (!messages) return;

  const div = document.createElement("div");
  div.className = "ai-msg ai-user";
  div.textContent = text;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}

function addBotMessage(text) {
  const messages = document.getElementById("aiMessages");
  if (!messages) return;

  const div = document.createElement("div");
  div.className = "ai-msg ai-bot";
  div.innerHTML = text;

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;

  saveChatMessage("bot", div.innerText);
}


  
  
  // ---------- SEND HANDLER ----------
  function sendMessage() {
    const text = input.value.trim();
    if (!text) return;

    // exit welcome mode
    container?.classList.remove("ai-welcome");

    // show user message
    addUserMessage(text);
    saveChatMessage("user", text);

    // clear input
    input.value = "";

    // typing indicator
    const typingId = "typing-" + Date.now();
    addBotMessage(`<span id="${typingId}">Typing…</span>`);

    // call CORE AI
    if (typeof window.analyzeAI === "function") {
      window.__LAST_AI_INPUT__ = text;
      window.analyzeAI(text)
        .catch(err => {
          console.error(err);
          addBotMessage("❌ Error while processing request.");
        })
        .finally(() => {
          document.getElementById(typingId)?.remove();
        });
    } else {
      addBotMessage("❌ AI engine not loaded.");
    }
  }

  // ---------- EVENTS ----------
  sendBtn.addEventListener("click", sendMessage);

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // ---------- LOAD CHAT HISTORY ----------
  const history = loadChatHistory();
  history.forEach(m => {
    if (m.role === "user") addUserMessage(m.text);
    else addBotMessage(m.text);
  });

});
