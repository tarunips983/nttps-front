if (!window.API) {
  window.API = "https://nttps-backend.onrender.com";
}

(function () {
  if (window.__SMART_ASSISTANT_LOADED__) return;
  window.__SMART_ASSISTANT_LOADED__ = true;

  const API = window.API;

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
    }

    if (result.columns && result.data) {
      renderTable(result.columns, result.data);
    }

  } catch (err) {
    hideTyping();
    console.error(err);
    addBotMessage("❌ Unable to process request.");
  }
}


  /* ================= RENDERERS ================= */
function renderTable(columns, rows) {
  if (!rows.length) {
    addBotMessage("No data found.");
    return;
  }

  const importantCols = [
    "pr_no",
    "work_name",
    "estimate_no",
    "name",
    "amount",
    "status",
    "division_label"
  ];

  function pretty(col) {
    return col.replace(/_/g, " ").toUpperCase();
  }

  let html = `<div class="ai-table-wrapper">`;

  rows.forEach((row, idx) => {
    html += `
      <div class="ai-card">
        <div class="ai-card-main">
    `;

    // 🔹 Main important fields
    importantCols.forEach(col => {
      if (row[col] !== undefined && row[col] !== null) {
        html += `
          <div class="ai-field">
            <span class="label">${pretty(col)}</span>
            <span class="value">${row[col]}</span>
          </div>
        `;
      }
    });

    html += `
        </div>

        <details class="ai-details">
          <summary>More details</summary>
          <table class="ai-table">
            <tbody>
    `;

    // 🔹 Remaining fields
    columns.forEach(col => {
      if (!importantCols.includes(col)) {
        let val = row[col] ?? "";

        // clickable PDF
        if (typeof val === "string" && val.startsWith("http")) {
          val = `<a href="${val}" target="_blank">Open</a>`;
        }

        html += `
          <tr>
            <th>${pretty(col)}</th>
            <td>${val}</td>
          </tr>
        `;
      }
    });

    html += `
            </tbody>
          </table>
        </details>

      </div>
    `;
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

  window.handleAskAI = handleAskAI;

  console.log("✅ Smart Assistant Core (SQL-only) loaded");
})();
