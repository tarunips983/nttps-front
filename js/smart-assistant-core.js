if (!window.API) {
  window.API = "https://nttps-backend.onrender.com";
}

// 🛑 GLOBAL LOOP PROTECTION
if (window.__SMART_CORE_ALREADY_RUNNING__) {
  console.warn("Smart core already running. Stopped duplicate load.");
  throw new Error("Duplicate core load blocked");
}
window.__SMART_CORE_ALREADY_RUNNING__ = true;


const API = window.API;
// ===== GLOBAL STREAM CONTROL =====
let isAITyping = false;
let currentAbortController = null;

let AUTH_STATE = "UNKNOWN"; // UNKNOWN | LOGGED_OUT | LOGGED_IN

function showLoginOverlay() {
  const overlay = document.getElementById("aiLoginOverlay");
  if (overlay) overlay.style.display = "flex";
}

function hideLoginOverlay() {
  const overlay = document.getElementById("aiLoginOverlay");
  if (overlay) overlay.style.display = "none";
}

function setGuestUI() {
  const nameEl = document.getElementById("smartUserName");
  const statusEl = document.getElementById("smartUserStatus");
  if (nameEl) nameEl.textContent = "Guest";
  if (statusEl) statusEl.textContent = "Login required";
}

function formatTime(dateStr) {
  const d = dateStr ? new Date(dateStr) : new Date();
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function renderMarkdown(text) {
  

  if (!text) return "";
  // ✅ Normalize paragraphs
  text = text.replace(/\n{3,}/g, "\n\n");
  let html = text;

  // Escape HTML
  html = html.replace(/</g, "&lt;").replace(/>/g, "&gt;");

  // ================= CODE BLOCKS =================
  html = html.replace(/```([\s\S]*?)```/g, (match, code) => {
    return `
      <div class="ai-code-block">
        <button class="copy-btn" onclick="navigator.clipboard.writeText(\`${code.replace(/`/g, "\\`")}\`)">Copy</button>
        <pre><code>${code}</code></pre>
      </div>
    `;
  });

  // ================= HEADINGS =================
  html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
  html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
  html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

  // ================= BOLD / ITALIC =================
  html = html.replace(/\*\*(.*?)\*\*/gim, "<b>$1</b>");
  html = html.replace(/\*(.*?)\*/gim, "<i>$1</i>");

  // ================= TABLES =================
  if (html.includes("|")) {
    const lines = html.split("\n");
    let tableMode = false;
    let tableHTML = "<table class='ai-md-table'>";

    let out = [];

    for (let line of lines) {
      if (line.includes("|")) {
        const cells = line.split("|").map(c => c.trim()).filter(Boolean);
        if (!tableMode) {
          tableMode = true;
          tableHTML = "<table class='ai-md-table'><tr>";
          cells.forEach(c => tableHTML += `<th>${c}</th>`);
          tableHTML += "</tr>";
        } else {
          tableHTML += "<tr>";
          cells.forEach(c => tableHTML += `<td>${c}</td>`);
          tableHTML += "</tr>";
        }
      } else {
        if (tableMode) {
          tableHTML += "</table>";
          out.push(tableHTML);
          tableMode = false;
        }
        out.push(line);
      }
    }

    if (tableMode) {
      tableHTML += "</table>";
      out.push(tableHTML);
    }

    html = out.join("\n");
  }

  // ================= LISTS =================
  html = html.replace(/^\s*[-•] (.*)$/gim, "<li>$1</li>");
  html = html.replace(/(<li>.*<\/li>)/gims, "<ul>$1</ul>");

  // ================= PARAGRAPHS =================
  html = html.replace(/\n\n+/g, "</p><p>");
  html = html.replace(/\n/g, "<br>");

  return `<div class="ai-formatted"><p>${html}</p></div>`;
}

async function streamAIResponse({ query, fileText }) {
  const token = localStorage.getItem("adminToken");

  currentAbortController = new AbortController();

  const res = await fetch(`${API}/ai/query-stream`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ query, fileText }),
    signal: currentAbortController.signal
  });

  if (!res.ok || !res.body) {
    throw new Error("Stream failed");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");

  let finalText = "";

  // Create live assistant bubble
  const box = document.getElementById("aiMessages");

  const wrapper = document.createElement("div");
  wrapper.className = "chat-bubble assistant-bubble streaming-bubble";

  const bubble = document.createElement("div");
  bubble.className = "bubble-body";
  bubble.textContent = "";

  wrapper.appendChild(bubble);
  box.appendChild(wrapper);
  box.scrollTop = box.scrollHeight;

  try {
    while (isAITyping) {
      const { value, done } = await reader.read();

      if (done) break;

      if (value) {
        const chunk = decoder.decode(value, { stream: true });
        finalText += chunk;
        bubble.innerHTML = renderMarkdown(finalText + "<span class='typing-cursor'>▍</span>");
        const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
if (nearBottom) box.scrollTop = box.scrollHeight;

      }
    }
  } catch (err) {
    if (err.name !== "AbortError") {
      console.error("Stream read error:", err);
    }
  } finally {
    try {
      await reader.cancel();
    } catch (e) {}
  }

  // ✅ REMOVE CURSOR AFTER STREAM FINISH
  bubble.innerHTML = renderMarkdown(finalText);

  currentAbortController = null;

  return finalText;
}



function renderMessageBubble({ role, content, created_at, file_url, message_id }) {
  const box = document.getElementById("aiMessages");
  if (!box) return;

  const wrapper = document.createElement("div");
  wrapper.className = "chat-bubble " + (role === "user" ? "user-bubble" : "assistant-bubble");

  if (message_id) {
    wrapper.dataset.id = message_id;
  }

  const bubble = document.createElement("div");
  bubble.className = "bubble-body";
  bubble.innerHTML = renderMarkdown(content || "");

  if (file_url) {
    const a = document.createElement("a");
    a.href = file_url;
    a.target = "_blank";
    a.textContent = "📎 Attachment";
    bubble.appendChild(document.createElement("br"));
    bubble.appendChild(a);
  }

  // 🛠 Action bar
  const actions = document.createElement("div");
  actions.className = "bubble-actions";

  // 📋 Copy
  const copyBtn = document.createElement("span");
  copyBtn.textContent = "📋";
  copyBtn.title = "Copy";
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(bubble.innerText || "");
  };

  // 💬 Quote
  const quoteBtn = document.createElement("span");
  quoteBtn.textContent = "💬";
  quoteBtn.title = "Quote";
  quoteBtn.onclick = () => {
    const input = document.getElementById("aiInput");
    if (!input) return;
    input.value = `> ${bubble.innerText}\n\n` + input.value;
    input.focus();
  };

  // 🔁 Retry (only for assistant)
  const retryBtn = document.createElement("span");
  retryBtn.textContent = "🔁";
  retryBtn.title = "Regenerate";

  if (role === "assistant") {
    retryBtn.onclick = () => {
      window.regenerateLastAnswer();
    };
  } else {
    retryBtn.style.display = "none";
  }

  actions.appendChild(copyBtn);
  actions.appendChild(quoteBtn);
  actions.appendChild(retryBtn);

  const time = document.createElement("div");
  time.className = "bubble-time";
  time.textContent = formatTime(created_at);

 const footer = document.createElement("div");
footer.className = "bubble-footer";

footer.appendChild(actions);
footer.appendChild(time);

wrapper.appendChild(bubble);
wrapper.appendChild(footer);


  box.appendChild(wrapper);
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
if (nearBottom) box.scrollTop = box.scrollHeight;

}



function setLoggedUI() {
  const nameEl = document.getElementById("smartUserName");
  const statusEl = document.getElementById("smartUserStatus");
  if (nameEl) nameEl.textContent = "User";
  if (statusEl) statusEl.textContent = "Logged in";
}

async function checkAuthOnce() {
  if (AUTH_STATE !== "UNKNOWN") return; // ✅ Only once

  const token = localStorage.getItem("adminToken");

  if (!token) {
    AUTH_STATE = "LOGGED_OUT";
    setGuestUI();
    showLoginOverlay();
    return;
  }

  try {
    const res = await fetch(`${API}/ai/conversations`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401 || res.status === 403) {
      console.warn("Token invalid");
      localStorage.removeItem("adminToken");
      AUTH_STATE = "LOGGED_OUT";
      setGuestUI();
      showLoginOverlay();
    } else {
      AUTH_STATE = "LOGGED_IN";
      hideLoginOverlay();
      setLoggedUI();
    }
  } catch (e) {
    console.warn("Backend sleeping. Not logging out.");
    // ❗ DO NOTHING
  }
}

(function () {
  if (window.__SMART_ASSISTANT_LOADED__) return;
  window.__SMART_ASSISTANT_LOADED__ = true;
   const API = window.API;
let currentConversationId = null;
let thinkingMsgDiv = null;
function startAIThinking() {
  isAITyping = true;
  setSendButtonMode("stop");
}


function stopAIThinking() {
  isAITyping = false;

  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  setSendButtonMode("send");
}

function renderDateSeparator(dateStr) {
  const box = document.getElementById("aiMessages");
  if (!box) return;

  const d = new Date(dateStr);
  const label = d.toDateString();

  const sep = document.createElement("div");
  sep.className = "chat-date-separator";
  sep.textContent = "——— " + label + " ———";

  box.appendChild(sep);
}

  function el(id) {
    return document.getElementById(id);
  }

  /* ================= CHAT HANDLERS ================= */
async function handleAskAI() {
  console.log("🧪 UI selectedFile at send time =", window.selectedFile);

  const input = el("aiInput");
  const msgBox = el("aiMessages");
  if (isAITyping) return;

  if (!input || !msgBox) return;

  const text = input.value.trim();
  const file = window.selectedFile || null;

  // Allow sending if either text OR file exists
  if (!text && !file) return;

  if (typeof window.enterChatMode === "function") {
    window.enterChatMode();
  }

  // Render user message immediately
  renderMessageBubble({
    role: "user",
    content: text || "[File uploaded]",
    created_at: new Date().toISOString()
  });

  input.value = "";

  const token = localStorage.getItem("adminToken");
  if (!token) {
    renderMessageBubble({
      role: "assistant",
      content: "🔒 Please login to use Smart Assistant.",
      created_at: new Date().toISOString()
    });
    return;
  }

  if (!currentConversationId) {
    await window.createNewChat();
  }

  let extractedText = "";

  // ================= FILE ANALYSIS =================
  if (file) {
    try {
      const fd = new FormData();
      fd.append("file", file);

      const analyzeRes = await fetch(`${API}/ai/analyze-file`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd
      });

      const analyzeResult = await analyzeRes.json();
      extractedText = analyzeResult.text || "";

    } catch (e) {
      console.error("❌ File analysis failed", e);
      renderMessageBubble({
        role: "assistant",
        content: "❌ Failed to analyze file.",
        created_at: new Date().toISOString()
      });
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

  // ================= STREAM AI RESPONSE =================

  startAIThinking();

  try {
    const finalReply = await streamAIResponse({
      query: text,
      fileText: extractedText
    });

    // Stream ended normally
   stopAIThinking();

    if (!finalReply) return;

    // Save assistant message
    await fetch(`${API}/ai/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        conversation_id: currentConversationId,
        role: "assistant",
        content: finalReply
      })
    });

  } catch (err) {
    isAITyping = false;
    setSendButtonMode("send");

    if (err.name === "AbortError") {
      console.log("Stream aborted");
    } else {
      console.error(err);
      renderMessageBubble({
        role: "assistant",
        content: "❌ Unable to process request.",
        created_at: new Date().toISOString()
      });
    }
  } finally {
    // ================= CLEAR FILE =================
    window.selectedFile = null;

    const preview = document.getElementById("filePreview");
    if (preview) {
      preview.style.display = "none";
      preview.innerHTML = "";
    }

    const fileInputEl = document.getElementById("chatFile");
    if (fileInputEl) fileInputEl.value = "";
  }
}

window.stopAIResponse = stopAIThinking;


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
    if (isAITyping) {
  stopAIThinking();
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
    renderMessageBubble({
      role: "assistant",
      content: "No data found.",
      created_at: new Date().toISOString()
    });
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

  renderMessageBubble({
  role: "assistant",
  content: html,
  created_at: new Date().toISOString()
});

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
div.className = "chat-item";
div.dataset.id = c.id;
if (c.id === currentConversationId) {
  div.classList.add("active");
}
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

  // Highlight active chat
  document.querySelectorAll(".chat-item").forEach(el => {
    el.classList.remove("active");
    if (el.dataset.id == id) {
      el.classList.add("active");
    }
  });

  // Clear UI
  clearChatUI();

  const token = localStorage.getItem("adminToken");

  let res;
  try {
    res = await fetch(`${API}/ai/conversations/${id}/messages`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  } catch (e) {
    addBotMessage("⚠️ Server waking up, try again in 5 seconds...");
    return;
  }

  if (!res.ok) {
    renderMessageBubble({
  role: "assistant",
  content: "⚠️ Failed to load conversation.",
  created_at: new Date().toISOString()
});
    return;
  }

  const messages = await res.json();

  if (!Array.isArray(messages)) {
    console.error("Invalid messages response:", messages);
    renderMessageBubble({
  role: "assistant",
  content: "⚠️ Failed to load messages.",
  created_at: new Date().toISOString()
});

    return;
  }
let lastDate = null;

messages.forEach(m => {
  const msgDate = new Date(m.created_at).toDateString();

  if (msgDate !== lastDate) {
    renderDateSeparator(m.created_at);
    lastDate = msgDate;
  }

  let text = m.content || "";

  renderMessageBubble({
    role: m.role,
    content: text,
    created_at: m.created_at,
    file_url: m.file_url
  });
});


  // Scroll to bottom
  // Scroll to bottom
const box = document.getElementById("aiMessages");
if (box) {
  const nearBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 120;
  if (nearBottom) box.scrollTop = box.scrollHeight;
}

};


  
document.addEventListener("DOMContentLoaded", async () => {
  if (window.bindSmartAssistantUI) {
    window.bindSmartAssistantUI();
  }

  await checkAuthOnce();

  if (AUTH_STATE !== "LOGGED_IN") return;

  try {
    await loadConversationList();
    const first = document.querySelector("#chatHistoryList .chat-item");
if (first) {
  const id = first.dataset.id;
  if (id) loadConversation(id);
}
  } catch (e) {
    console.warn("Backend still waking up...");
  }
});


  window.handleAskAI = handleAskAI;



  console.log("✅ Smart Assistant Core (SQL-only) loaded");
})();
