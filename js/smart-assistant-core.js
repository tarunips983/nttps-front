if (!window.API) {
  window.API = "https://nttps-backend.onrender.com";
}

(function () {
  if (window.__SMART_ASSISTANT_LOADED__) return;
  window.__SMART_ASSISTANT_LOADED__ = true;
   const API = window.API;
let currentConversationId = null;

   
let conversations = JSON.parse(localStorage.getItem("ai_conversations") || "{}");


function saveMessage(role, content) {
  if (!currentConversationId) createNewChat();

  conversations[currentConversationId].messages.push({
    role,
    content,
    time: Date.now()
  });

  if (
    role === "user" &&
    conversations[currentConversationId].messages.length === 1
  ) {
    conversations[currentConversationId].title = content.slice(0, 30);
  }

  saveConversations();
}

function saveConversations() {
  localStorage.setItem("ai_conversations", JSON.stringify(conversations));

  // 🔁 sync UI after every save
  if (window.syncChatUI) {
    window.syncChatUI();
  }
}


  


  function el(id) {
    return document.getElementById(id);
  }

  /* ================= CHAT HANDLERS ================= */

  async function handleAskAI() {
  const input = el("aiInput");
  const msgBox = el("aiMessages");

  if (!input || !msgBox) return;

  const text = input.value.trim();
  if (!text) return;

  // 🔑 EXIT WELCOME MODE
  if (typeof window.enterChatMode === "function") {
    window.enterChatMode();
  }

  addUserMessage(text);
saveMessage("user", text);


  input.value = "";

  const token = localStorage.getItem("adminToken");
  if (!token) {
    addBotMessage("🔒 Please login to use Smart Assistant.");
    return;
  }

  showTyping();

  try {
    const res = await fetch(`${API}/ai/query`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ query: text })
    });

    const result = await res.json();
    hideTyping();

    if (result.reply) {
  addBotMessage(result.reply);

  saveMessage("assistant", {
    text: result.reply,
    type: result.columns && result.data ? "TABLE" : "TEXT",
    payload: result.columns && result.data
      ? { columns: result.columns, rows: result.data }
      : null
  });
}


   } catch (err) {
    hideTyping();
    console.error(err);
    addBotMessage("❌ Unable to process request.");
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

  function showTyping() {
    const t = el("aiTyping");
    if (t) t.style.display = "block";
  }

  function hideTyping() {
    const t = el("aiTyping");
    if (t) t.style.display = "none";
  }
window.createNewChat = function () {
  currentConversationId = "conv_" + Date.now();

  conversations[currentConversationId] = {
    id: currentConversationId,
    title: "New Conversation",
    createdAt: Date.now(),
    messages: []
  };

  saveConversations();

  const msgBox = document.getElementById("aiMessages");
  if (msgBox) msgBox.innerHTML = "";

  if (window.renderChatHistory) {
    window.renderChatHistory();
  }
};

  window.handleAskAI = handleAskAI;

  console.log("✅ Smart Assistant Core (SQL-only) loaded");
})();
