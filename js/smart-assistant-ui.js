console.log("✅ Smart Assistant UI loaded");

document.addEventListener("DOMContentLoaded", () => {

  const container = document.getElementById("smart-assistant-container");


 const input = document.getElementById("aiChatInput");

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


  
  
sendBtn.addEventListener("click", () => {
  if (typeof window.handleAskAI === "function") {
    window.handleAskAI();
  } else {
    console.error("handleAskAI not found");
  }
});
  
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
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
// 🔥 expose UI helpers globally
window.addUserMessage = addUserMessage;
window.addBotMessage = addBotMessage;

});
