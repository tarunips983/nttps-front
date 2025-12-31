console.log("✅ Smart Assistant UI loaded");

// ================= CHAT STATE ACCESS =================
window.conversations = window.conversations || JSON.parse(
  localStorage.getItem("ai_conversations") || "{}"
);

window.currentConversationId = window.currentConversationId || null;

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

  const container = document.getElementById("smart-assistant-container");
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
  if (!window.createNewChat) {
  window.createNewChat = function () {
    alert("Chat system not ready yet");
  };
}

  }


document.addEventListener("DOMContentLoaded", () => {
  if (window.bindSmartAssistantUI) {
    window.bindSmartAssistantUI();
  }

  if (window.renderChatHistory) {
    window.renderChatHistory();
  }

  const ids = Object.keys(window.conversations || {});
  if (ids.length) {
    window.loadConversation(ids[0]);
  }
});


window.renderChatHistory = function () {
  const list = document.getElementById("chatHistoryList");
  if (!list) return;

  list.innerHTML = "";

  Object.values(window.conversations)
    .sort((a, b) => b.createdAt - a.createdAt)
    .forEach(conv => {
      const div = document.createElement("div");
      div.className =
        "chat-item" +
        (conv.id === window.currentConversationId ? " active" : "");
      div.textContent = conv.title;
      div.onclick = () => window.loadConversation(conv.id);
      list.appendChild(div);
    });
};
window.loadConversation = function (id) {
  window.currentConversationId = id;
  clearChatUI();

  const conv = window.conversations[id];
  if (!conv) return;

  conv.messages.forEach(m => {
    if (m.role === "user") window.addUserMessage(m.content);
    else window.addBotMessage(m.content);
  });

  window.renderChatHistory();
};

function clearChatUI() {
  const messages = document.getElementById("aiMessages");
  if (messages) messages.innerHTML = "";
}
// Sync UI when conversations change
window.syncChatUI = function () {
  window.conversations = JSON.parse(
    localStorage.getItem("ai_conversations") || "{}"
  );
  if (window.renderChatHistory) {
    window.renderChatHistory();
  }
};
