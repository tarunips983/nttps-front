if (!window.API) {
  window.API = "https://nttps-backend.onrender.com";
}


(function () {
  if (window.__SMART_ASSISTANT_LOADED__) return;
  window.__SMART_ASSISTANT_LOADED__ = true;
   const API = window.API;
let currentConversationId = null;

let isAITyping = false;
let currentAbortController = null;
let typingInterval = null;

let thinkingMsgDiv = null;
  window.isAITyping = false;


function showStatusMessage(text) {
  const messages = document.getElementById("aiMessages");
  if (!messages) return;

  thinkingMsgDiv = document.createElement("div");
  thinkingMsgDiv.className = "ai-msg ai-bot ai-thinking";
  thinkingMsgDiv.textContent = text;
  messages.appendChild(thinkingMsgDiv);
  messages.scrollTop = messages.scrollHeight;
}

function removeStatusMessage() {
  if (thinkingMsgDiv) {
    thinkingMsgDiv.remove();
    thinkingMsgDiv = null;
  }
}


  
  function el(id) {
    return document.getElementById(id);
  }

  /* ================= CHAT HANDLERS ================= */

  async function handleAskAI() {
  const input = el("aiInput");
  const msgBox = el("aiMessages");
const fileInput = document.getElementById("chatFile");
const file = fileInput ? fileInput.files[0] : null;

  if (!input || !msgBox) return;

  const text = input.value.trim();
  if (!text) return;

  if (typeof window.enterChatMode === "function") {
    window.enterChatMode();
  }

  addUserMessage(text);
  input.value = "";

 const token = localStorage.getItem("adminToken");
if (!token) {
  addBotMessage("🔒 Please login to use Smart Assistant.");
  return;
}


  if (!currentConversationId) {
    await window.createNewChat();
  }
let uploadedFileUrl = null;

if (file) {
  const fd = new FormData();
  fd.append("file", file);

  const uploadRes = await fetch(`${API}/ai/upload-chat-file`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: fd
  });

  const uploadResult = await uploadRes.json();
  uploadedFileUrl = uploadResult.url || null;

  // clear file input
  fileInput.value = "";
}

  // Save user message to DB
  await fetch(`${API}/ai/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
  conversation_id: currentConversationId,
  role: "user",
  content: text,
  file_url: uploadedFileUrl
})

  });

showTyping();
    showStatusMessage("🤔 Thinking...");

    
try {
  currentAbortController = new AbortController();

  const res = await fetch(`${API}/ai/query`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`
  },
  body: JSON.stringify({ query: text }),
  signal: currentAbortController.signal
});


    const result = await res.json();

// Update status based on backend mode
removeStatusMessage();

if (result.mode === "web") {
  showStatusMessage("🌐 Searching the web...");
} else if (result.mode === "db") {
  showStatusMessage("📊 Searching records...");
} else {
  showStatusMessage("🤔 Thinking...");
}

// Small delay so user sees it
await new Promise(r => setTimeout(r, 400));

hideTyping();
removeStatusMessage();

    if (!result.reply) {
      addBotMessage("No response.");
      return;
    }

    const msgDiv = document.createElement("div");
    msgDiv.className = "ai-message";
    el("aiMessages").appendChild(msgDiv);

    typeWriter(msgDiv, result.reply, 15);

    // Save assistant message to DB
    await fetch(`${API}/ai/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        conversation_id: currentConversationId,
        role: "assistant",
        content: result.reply
      })
    });

    if (result.columns && result.data) {
      setTimeout(() => {
        renderTable(result.columns, result.data);
      }, Math.min(2000, result.reply.length * 15));
    }

  } catch (err) {
    setSendButtonMode("send");
isAITyping = false;

    hideTyping();
    console.error(err);
    addBotMessage("❌ Unable to process request.");
  }
}
window.stopAIResponse = function () {
  console.log("⛔ AI stopped");

  isAITyping = false;
  window.isAITyping = false;

  // Stop typing animation immediately
  if (typingInterval) {
    clearInterval(typingInterval);
    typingInterval = null;
  }

  // Abort fetch if still running
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  setSendButtonMode("send");
};


function setSendButtonMode(mode) {
  const icon = document.getElementById("sendIcon");
  if (!icon) return;

  if (mode === "stop") {
    icon.textContent = "⏹";
  } else {
    icon.textContent = "▶️";
  }
}

  
function detectModule(columns) {
  if (columns.includes("estimate_no")) return "ESTIMATE";
  if (columns.includes("pr_no")) return "RECORD";
  if (columns.includes("aadhar")) return "CL";
  if (columns.includes("date") && columns.includes("activity")) return "DAILY";
  return "UNKNOWN";
}
const RECORD_FIELDS = [
  "pr_no",
  "work_name",
  "amount",
  "status",
  "pr_status",
  "division_label",
  "send_to"
];
const ESTIMATE_FIELDS = [
  "estimate_no",
  "pr_no",
  "description",
  "gross_amount",
  "net_amount",
  "loa_no",
  "status",
  "division_label"
];
const CL_FIELDS = ["name","aadhar","phone","division","station"];
const DAILY_FIELDS = ["date","activity","status","division_label"];

  /* ================= RENDERERS ================= */
function renderTable(columns, rows) {
  if (!rows || !rows.length) {
    addBotMessage("No data found.");
    return;
  }

  const module = detectModule(columns);

  let importantCols = [];
  if (module === "RECORD") importantCols = RECORD_FIELDS;
  else if (module === "ESTIMATE") importantCols = ESTIMATE_FIELDS;
  else if (module === "CL") importantCols = CL_FIELDS;
  else if (module === "DAILY") importantCols = DAILY_FIELDS;
  else importantCols = columns;

  function pretty(col) {
    return col.replace(/_/g, " ").toUpperCase();
  }

  let html = `<div class="ai-table-wrapper">`;

  rows.forEach(row => {
    html += `<div class="ai-card"><div class="ai-card-main">`;

    /* ================= MAIN SUMMARY ================= */
    importantCols.forEach(col => {
      if (row[col] === undefined || row[col] === null) return;

      // ✅ CLICKABLE ESTIMATE NO
      if (module === "ESTIMATE" && col === "estimate_no") {
        html += `
          <div class="ai-field">
            <span class="label">${pretty(col)}</span>
            <span class="value">
              <a href="estimate.html?estimate_no=${row[col]}" target="_blank">
                ${row[col]}
              </a>
            </span>
          </div>
        `;
        return;
      }

      // normal field
      html += `
        <div class="ai-field">
          <span class="label">${pretty(col)}</span>
          <span class="value">${row[col]}</span>
        </div>
      `;
    });

    /* ================= DETAILS ================= */
    html += `
      </div>
      <details class="ai-details">
        <summary>More details</summary>
        <table class="ai-table"><tbody>
    `;

    columns.forEach(col => {
      if (importantCols.includes(col)) return;

      let val = row[col] ?? "";

      if (typeof val === "string" && val.startsWith("http")) {
        val = `<a href="${val}" target="_blank">Open</a>`;
      }

      html += `
        <tr>
          <th>${pretty(col)}</th>
          <td>${val}</td>
        </tr>
      `;
    });

    html += `
        </tbody></table>
      </details>
    </div>`;
  });

  html += `
    <div class="ai-actions">
      <button onclick="exportTable()">Export CSV</button>
      <button onclick="window.print()">Print</button>
    </div>
  </div>
  `;

  addBotMessage(html);
}
window.renderTable = renderTable;
  /* ================= EXPORT ================= */

  window.exportTable = function () {
    const rows = document.querySelectorAll("#aiMessages table tr");
    let csv = [];

    rows.forEach(row => {
      const cols = row.querySelectorAll("td, th");
      csv.push([...cols].map(c => `"${c.innerText}"`).join(","));
    });

    const blob = new Blob([csv.join("\n")], { type: "text/csv" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "data.csv";
    link.click();
  };

  /* ================= UI HELPERS ================= */
function typeWriter(element, text, speed = 20) {
  element.innerHTML = "";
  let i = 0;

  isAITyping = true;
window.isAITyping = true;
setSendButtonMode("stop");

  typingInterval = setInterval(() => {
    if (i >= text.length || !isAITyping) {
      clearInterval(typingInterval);
      typingInterval = null;
      isAITyping = false;
window.isAITyping = false;
setSendButtonMode("send");
      return;
    }

    element.innerHTML += text.charAt(i);
    i++;

    const box = document.getElementById("aiMessages");
    if (box) box.scrollTop = box.scrollHeight;
  }, speed);
}

  function showTyping() {
    const t = el("aiTyping");
    if (t) t.style.display = "block";
  }

  function hideTyping() {
    const t = el("aiTyping");
    if (t) t.style.display = "none";
  }
window.createNewChat = async function () {
  const token = localStorage.getItem("adminToken");

  const res = await fetch(`${API}/ai/conversations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ title: "New Chat" })
  });

  const conv = await res.json();
  currentConversationId = conv.id;

  clearChatUI();

  // ✅ Reload list ONCE and auto-open this chat
  await loadConversationList();
  loadConversation(conv.id);
};

async function loadConversationList() {
  const token = localStorage.getItem("adminToken");

  const res = await fetch(`${API}/ai/conversations`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const list = await res.json();
  if (!Array.isArray(list)) {
  console.error("Conversations API returned:", list);
  return;
}


  const ui = document.getElementById("chatHistoryList");
  ui.innerHTML = "";

  list.forEach(c => {
    const div = document.createElement("div");
    div.className = "chat-item" + (c.id === currentConversationId ? " active" : "");
    div.textContent = c.title || "New Chat";
    div.onclick = () => loadConversation(c.id);

    // 🗑️ Delete button
    const del = document.createElement("span");
    del.innerHTML = " 🗑️";
    del.style.float = "right";
    del.style.cursor = "pointer";

    del.onclick = async (e) => {
      e.stopPropagation();
      if (!confirm("Delete this chat?")) return;

      await fetch(`${API}/ai/conversations/${c.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      });

      if (currentConversationId === c.id) {
        currentConversationId = null;
        clearChatUI();
      }

      loadConversationList();
    };

    // ✏️ Rename on double click
    div.ondblclick = async () => {
      const newTitle = prompt("Rename chat:", c.title);
      if (!newTitle) return;

      await fetch(`${API}/ai/conversations/${c.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ title: newTitle })
      });

      loadConversationList();
    };

    div.appendChild(del);
    ui.appendChild(div);
  });
}

window.loadConversation = async function (id) {
  currentConversationId = id;
  clearChatUI();

  const token = localStorage.getItem("adminToken");

  const res = await fetch(`${API}/ai/conversations/${id}/messages`, {
    headers: { Authorization: `Bearer ${token}` }
  });

const messages = await res.json();

if (!Array.isArray(messages)) {
  console.error("Invalid messages response:", messages);
  addBotMessage("⚠️ Failed to load messages.");
  return;
}



 messages.forEach(m => {
  let text = m.content || "";

  if (m.file_url) {
    text += `<br><a href="${m.file_url}" target="_blank">📎 Attachment</a>`;
  }

  if (m.role === "user") addUserMessage(text);
  else addBotMessage(text);
});

  

};

  
document.addEventListener("DOMContentLoaded", async () => {
  if (window.bindSmartAssistantUI) {
    window.bindSmartAssistantUI();
  }

  const token = localStorage.getItem("adminToken");
  if (!token) return;

  await loadConversationList();

  // ✅ Auto-open first conversation
  const first = document.querySelector("#chatHistoryList .chat-item");
  if (first) first.click();
});


  window.handleAskAI = handleAskAI;
  window.stopAIResponse = stopAIResponse;
window.isAITyping = isAITyping;


  console.log("✅ Smart Assistant Core (SQL-only) loaded");
})();
