console.log("✅ Smart Assistant UI loaded");




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
const fileInput = document.getElementById("chatFile");
const previewBox = document.getElementById("filePreview");

if (fileInput && previewBox) {
  fileInput.onchange = () => {
    const file = fileInput.files[0];
    if (!file) return;

    previewBox.style.display = "block";

    if (file.type.startsWith("image/")) {
      const url = URL.createObjectURL(file);
      previewBox.innerHTML = `<img src="${url}" style="max-width:200px;border-radius:8px;border-radius:8px">`;
    } 
    else if (file.type === "application/pdf") {
      previewBox.innerHTML = `
        <div style="padding:8px;border:1px solid #ccc;border-radius:6px">
          📄 ${file.name}
        </div>
      `;
    } 
    else {
      previewBox.innerHTML = `📎 ${file.name}`;
    }
  };
}

  if (window.__SMART_ASSISTANT_BOUND__) {
    return;
  }

  const container = document.getElementById("smart-assistant-container");
  const input = document.getElementById("aiInput");
  const sendBtn = document.getElementById("aiSendBtn");
  const attachBtn = document.getElementById("attachBtn");


if (attachBtn && fileInput) {
  attachBtn.onclick = () => fileInput.click();
}

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
  if (window.isAITyping) {
    window.stopAIResponse();
  } else {
    window.handleAskAI();
  }
};
;

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



window.clearChatUI = function () {
  const messages = document.getElementById("aiMessages");
  if (messages) messages.innerHTML = "";
};


