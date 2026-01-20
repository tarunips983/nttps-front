console.log("✅ Smart Assistant UI loaded");

window.selectedFile = null;

const messages = document.getElementById("aiMessages");

window.addBotMessage = function (text) {
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

window.addUserMessage = function (text, file) {
  const div = document.createElement("div");
  div.className = "ai-msg ai-user";

  if (file) {
    console.log("🧾 UI showing file in chat:", file.name);

    if (file.type && file.type.startsWith("image/")) {
      const img = document.createElement("img");
      img.src = URL.createObjectURL(file);
      img.className = "chat-image-preview";
      div.appendChild(img);
    } else {
      const fileDiv = document.createElement("div");
      fileDiv.style.padding = "8px";
      fileDiv.style.border = "1px solid #ccc";
      fileDiv.style.borderRadius = "6px";
      fileDiv.textContent = "📎 " + file.name;
      div.appendChild(fileDiv);
    }
  }

  if (text) {
    const p = document.createElement("div");
    p.textContent = text;
    div.appendChild(p);
  }

  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
};


window.bindSmartAssistantUI = function () {
  const fileInput = document.getElementById("chatFile");
  const previewBox = document.getElementById("filePreview");
  const attachBtn = document.getElementById("attachBtn");

  if (attachBtn && fileInput) {
    attachBtn.onclick = () => fileInput.click();
  }

  if (fileInput && previewBox) {
    fileInput.onchange = () => {
  const file = fileInput.files[0];
  if (!file) return;

  console.log("📁 UI File selected:", file.name, file.type, file.size);  // ✅ ADD THIS

  window.selectedFile = file; // ✅ CRITICAL

  previewBox.style.display = "block";

  if (file.type.startsWith("image/")) {
    const url = URL.createObjectURL(file);
    previewBox.innerHTML = `<img src="${url}" class="chat-image-preview">`;
  } else if (file.type === "application/pdf") {
    previewBox.innerHTML = `<div style="padding:8px;border:1px solid #ccc;border-radius:6px">📄 ${file.name}</div>`;
  } else {
    previewBox.innerHTML = `📎 ${file.name}`;
  }
};

  }

  if (window.__SMART_ASSISTANT_BOUND__) return;

  const container = document.getElementById("smart-assistant-container");
  const messagesBox = document.getElementById("aiMessages");

  if (!container || !messagesBox) {
    console.warn("⚠️ Smart Assistant UI still not ready");
    return;
  }

  window.__SMART_ASSISTANT_BOUND__ = true;
  console.log("✅ Smart Assistant UI bound");

  function enterChatMode() {
    container.classList.remove("ai-welcome");
    messagesBox.style.display = "block";
  }

  window.enterChatMode = enterChatMode;
};

window.regenerateLastAnswer = async function () {
  if (isAITyping) return;

  const token = localStorage.getItem("adminToken");
  if (!token || !currentConversationId) return;

  // Find last user message in UI
  const bubbles = document.querySelectorAll(".chat-bubble.user-bubble .bubble-body");
  if (!bubbles.length) return;

  const lastUserText = bubbles[bubbles.length - 1].innerText;

  const input = document.getElementById("aiInput");
  input.value = lastUserText;

  await handleAskAI();
};


window.clearChatUI = function () {
  const messages = document.getElementById("aiMessages");
  if (messages) messages.innerHTML = "";
};
