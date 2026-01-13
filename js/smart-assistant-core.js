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
   console.log("🧪 UI selectedFile at send time =", window.selectedFile);
  const input = el("aiInput");
  const msgBox = el("aiMessages");

  if (!input || !msgBox) return;

  const text = input.value.trim();
  const file = window.selectedFile || null;

  // Allow sending if either text OR file exists
  if (!text && !file) return;

  if (typeof window.enterChatMode === "function") {
    window.enterChatMode();
  }

  addUserMessage(text, file);
  input.value = "";

  const token = localStorage.getItem("adminToken");
  if (!token) {
    addBotMessage("🔒 Please login to use Smart Assistant.");
    return;
  }

  if (!currentConversationId) {
    await window.createNewChat();
  }

  let extractedText = "";

  // ================= FILE ANALYSIS =================
  if (file) {
    try {
      console.log("📎 UI sending file:", file.name, file.type, file.size);

      const fd = new FormData();
      fd.append("file", file);

      const analyzeRes = await fetch(`${API}/ai/analyze-file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });

      const analyzeResult = await analyzeRes.json();
      extractedText = analyzeResult.text || "";

      if (analyzeResult.source) {
        showStatusMessage(`🧠 Extracted using ${analyzeResult.source.toUpperCase()}`);
        setTimeout(() => removeStatusMessage(), 1500);
      }

    } catch (e) {
      console.error("❌ File analysis failed", e);
      addBotMessage("❌ Failed to analyze file.");
    }
  }

  // ================= SAVE USER MESSAGE =================
  await fetch(`${API}/ai/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      conversation_id: currentConversationId,
      role: "user",
      content: text || "[File uploaded]"
    })
  });

  showTyping();
  showStatusMessage("🤔 Thinking...");
  setSendButtonMode("stop");

  try {
    currentAbortController = new AbortController();

    const res = await fetch(`${API}/ai/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        query: text,
        fileText: extractedText
      }),
      signal: currentAbortController.signal
    });

    const result = await res.json();

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

    // ================= SAVE ASSISTANT MESSAGE =================
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

    // ================= CLEAR FILE =================
    window.selectedFile = null;

    const preview = document.getElementById("filePreview");
    if (preview) {
      preview.style.display = "none";
      preview.innerHTML = "";
    }

    const fileInputEl = document.getElementById("chatFile");
    if (fileInputEl) fileInputEl.value = "";

    if (result.columns && result.data) {
      setTimeout(() => {
        renderTable(result.columns, result.data);
      }, Math.min(2000, result.reply.length * 15));
    }

    setSendButtonMode("send");

  } catch (err) {
    hideTyping();
    setSendButtonMode("send");
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
const sendBtn = document.getElementById("aiSendBtn");

if (sendBtn) {
  sendBtn.onclick = () => {
    if (window.isAITyping) {
      window.stopAIResponse();
    } else {
      handleAskAI();
    }
  };
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

function typeWriter(element, text, speed = 15) {
  element.innerHTML = "";

  // 🔥 Convert text formatting to HTML
  const formatted = text
    .replace(/\n\n+/g, "</p><p>")    // paragraphs
    .replace(/\n/g, "<br>")          // line breaks
    .replace(/\*\*(.*?)\*\*/g, "<b>$1</b>")  // bold
    .replace(/\*(.*?)\*/g, "• $1");  // simple bullets

  let i = 0;
  let output = "";

  isAITyping = true;
  window.isAITyping = true;
  setSendButtonMode("stop");

  typingInterval = setInterval(() => {
    if (i >= formatted.length || !isAITyping) {
      clearInterval(typingInterval);
      typingInterval = null;
      isAITyping = false;
      window.isAITyping = false;
      setSendButtonMode("send");
      return;
    }

    output += formatted.charAt(i);
    element.innerHTML = `<div class="ai-formatted"><p>${output}</p></div>`;

    const box = document.getElementById("aiMessages");
    if (box) box.scrollTop = box.scrollHeight;

    i++;
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

// ✅ ADD THIS BLOCK
if (res.status === 401 || res.status === 403) {
  localStorage.removeItem("adminToken");
  alert("Session expired. Please login again.");
  location.reload();
  return;
}
  
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



  console.log("✅ Smart Assistant Core (SQL-only) loaded");
})();
