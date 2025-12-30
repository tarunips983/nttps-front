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

    let html = `<table style="width:100%;border-collapse:collapse">`;
    html += "<tr>";
    columns.forEach(c => {
      html += `<th style="border:1px solid #ccc;padding:6px">${c}</th>`;
    });
    html += "</tr>";

    rows.forEach(row => {
      html += "<tr>";
      columns.forEach(c => {
        html += `<td style="border:1px solid #ccc;padding:6px">${row[c] ?? ""}</td>`;
      });
      html += "</tr>";
    });

    html += "</table>";
    html += `
      <div style="margin-top:6px">
        <button onclick="exportTable()">Export</button>
        <button onclick="window.print()">Print</button>
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
