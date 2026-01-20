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

function renderMessageBubble({ role, content, created_at, file_url }) {
  const box = document.getElementById("aiMessages");
  if (!box) return;

  const wrapper = document.createElement("div");
  wrapper.className = "chat-bubble " + (role === "user" ? "user-bubble" : "assistant-bubble");

  const bubble = document.createElement("div");
  bubble.className = "bubble-body";

  bubble.innerHTML = content || "";

  if (file_url) {
    const a = document.createElement("a");
    a.href = file_url;
    a.target = "_blank";
    a.textContent = "📎 Attachment";
    bubble.appendChild(document.createElement("br"));
    bubble.appendChild(a);
  }

  const time = document.createElement("div");
  time.className = "bubble-time";
  time.textContent = formatTime(created_at);

  wrapper.appendChild(bubble);
  wrapper.appendChild(time);

  box.appendChild(wrapper);
  box.scrollTop = box.scrollHeight;
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

let isAITyping = false;
let currentAbortController = null;
let typingInterval = null;

let thinkingMsgDiv = null;

function startAIThinking() {
  isAITyping = true;
  setSendButtonMode("stop");
  showStatusMessage("🤔 Thinking...");
}

function stopAIThinking() {
  isAITyping = false;

  // Stop typing animation
  if (typingInterval) {
    clearInterval(typingInterval);
    typingInterval = null;
  }

  // Abort fetch
  if (currentAbortController) {
    currentAbortController.abort();
    currentAbortController = null;
  }

  removeStatusMessage();
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
if (isAITyping) return;

  if (!input || !msgBox) return;

  const text = input.value.trim();
  const file = window.selectedFile || null;

  // Allow sending if either text OR file exists
  if (!text && !file) return;

  if (typeof window.enterChatMode === "function") {
    window.enterChatMode();
  }

  renderMessageBubble({
  role: "user",
  content: text || "[File uploaded]",
  created_at: new Date().toISOString()
});

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

startAIThinking();
currentAbortController = new AbortController();

try {
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

 // We are still in "AI working" state while typing
if (!result.reply) {
  stopAIThinking();
  return;
}

const msgDiv = document.createElement("div");
msgDiv.className = "ai-message";
el("aiMessages").appendChild(msgDiv);

// Start typing animation while still in AI mode
typeWriter(msgDiv, result.reply, 15);

// Only stop AI mode when typing finishes


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
  } catch (err) {
    stopAIThinking();
    if (err.name === "AbortError") {
  console.log("Request aborted");
} else {
  console.error(err);
  addBotMessage("❌ Unable to process request.");
}
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
  content: html,
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

  typingInterval = setInterval(() => {
   if (i >= formatted.length || !isAITyping) {
  clearInterval(typingInterval);
  typingInterval = null;
  stopAIThinking();   // ✅ THIS IS IMPORTANT
  return;
}

    output += formatted.charAt(i);
    element.innerHTML = `<div class="ai-formatted"><p>${output}</p></div>`;

    const box = document.getElementById("aiMessages");
    if (box) box.scrollTop = box.scrollHeight;

    i++;
  }, speed);
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
  const box = document.getElementById("aiMessages");
  if (box) box.scrollTop = box.scrollHeight;
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
